import { Parser } from '../parser/Parser';
import { CloudFormationTemplate } from './types';
import * as yaml from 'yaml';
import { PrettyPrinter } from './PrettyPrinter';

export class Compiler {
  compile(source: string): CloudFormationTemplate {
    const parser = new Parser(source);
    const ast = parser.parse();
    return ast.toCloudFormation();
  }

  compileToYAML(source: string): string {
    const template = this.compile(source);
    return yaml.stringify(template, { lineWidth: 0 });
  }

  compileToJSON(source: string): string {
    const template = this.compile(source);
    return JSON.stringify(template, null, 2);
  }
}

export class Decompiler {
  private printer = new PrettyPrinter();
  
  decompile(template: CloudFormationTemplate): string {
    const lines: string[] = [];
    
    if (template.AWSTemplateFormatVersion) {
      lines.push(`AWSTemplateFormatVersion('${template.AWSTemplateFormatVersion}')`);
    }
    
    if (template.Description) {
      lines.push(`Description('${template.Description}')`);
    }
    
    if (template.Transform) {
      if (Array.isArray(template.Transform)) {
        lines.push(`Transform([${template.Transform.map(t => `'${t}'`).join(', ')}])`);
      } else {
        lines.push(`Transform('${template.Transform}')`);
      }
    }
    
    if (template.Metadata) {
      lines.push(`Metadata(${this.objectToSource(template.Metadata)})`);
    }
    
    if (template.Parameters) {
      for (const [name, param] of Object.entries(template.Parameters)) {
        lines.push(`${name} = Parameter(${this.objectToSource(param)})`);
      }
    }
    
    if (template.Mappings && Object.keys(template.Mappings).length > 0) {
      for (const [name, mapping] of Object.entries(template.Mappings)) {
        lines.push(`${name} = Mapping(${this.objectToSource(mapping)})`);
      }
    }
    
    if (template.Conditions) {
      for (const [name, condition] of Object.entries(template.Conditions)) {
        lines.push(`${name} = Condition(${this.valueToSource(condition)})`);
      }
    }
    
    if (template.Resources) {
      for (const [name, resource] of Object.entries(template.Resources)) {
        let line = `${name} = Resource('${resource.Type}', ${this.objectToSource(resource.Properties || {})})`;
        
        if (resource.DependsOn) {
          const deps = Array.isArray(resource.DependsOn) ? resource.DependsOn : [resource.DependsOn];
          line += ` DependsOn(${deps.map(d => `'${d}'`).join(', ')})`;
        }
        if (resource.Condition) {
          line += ` Condition(${resource.Condition})`;
        }
        if (resource.DeletionPolicy) {
          line += ` DeletionPolicy('${resource.DeletionPolicy}')`;
        }
        if (resource.UpdateReplacePolicy) {
          line += ` UpdateReplacePolicy('${resource.UpdateReplacePolicy}')`;
        }
        if (resource.Metadata) {
          line += ` Metadata(${this.objectToSource(resource.Metadata)})`;
        }
        if (resource.CreationPolicy) {
          line += ` CreationPolicy(${this.objectToSource(resource.CreationPolicy)})`;
        }
        if (resource.UpdatePolicy) {
          line += ` UpdatePolicy(${this.objectToSource(resource.UpdatePolicy)})`;
        }
        
        lines.push(line);
      }
    }
    
    if (template.Outputs) {
      for (const [name, output] of Object.entries(template.Outputs)) {
        lines.push(`${name} = Output(${this.objectToSource(output)})`);
      }
    }
    
    if (template.Rules) {
      for (const [name, rule] of Object.entries(template.Rules)) {
        lines.push(`${name} = Rule(${this.objectToSource(rule)})`);
      }
    }
    
    return this.printer.format(lines.join('\n\n'));
  }

  private objectToSource(obj: Record<string, any>): string {
    const props = Object.entries(obj)
      .map(([key, value]) => {
        // Quote keys that contain special characters
        const needsQuoting = /[.\-\s:]/.test(key) || !(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key));
        const quotedKey = needsQuoting ? `'${key.replace(/'/g, "\\'")}'` : key;
        return `${quotedKey}: ${this.valueToSource(value)}`;
      })
      .join(', ');
    return `{ ${props} }`;
  }
  
  private valueToSource(value: any, context: 'property' | 'argument' = 'argument'): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'string') {
      // Escape special characters in strings
      const escaped = value
        .replace(/\\/g, '\\\\')  // Backslash first
        .replace(/'/g, "\\'")     // Single quotes
        .replace(/\n/g, '\\n')    // Newlines
        .replace(/\r/g, '\\r')    // Carriage returns
        .replace(/\t/g, '\\t');   // Tabs
      return `'${escaped}'`;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      return `[${value.map(v => this.valueToSource(v, context)).join(', ')}]`;
    }
    
    if (typeof value === 'object') {
      // Check for intrinsic functions
      if (value.Ref) {
        // Check if it's a pseudo-parameter (starts with AWS::) - convert to AWS.Property
        if (value.Ref.startsWith('AWS::')) {
          const property = value.Ref.substring(5); // Remove 'AWS::'
          return `AWS.${property}`;
        }
        // Regular ref - return as identifier
        return value.Ref;
      }
      
      if (value['Fn::GetAtt']) {
        const [resource, attr] = value['Fn::GetAtt'];
        return `${resource}.${attr}`;
      }
      
      // Handle all other Fn:: intrinsics
      for (const key of Object.keys(value)) {
        if (key.startsWith('Fn::')) {
          const funcName = key.substring(4);
          const args = value[key];
          
          // Special handling for Equals - output as == operator
          if (funcName === 'Equals' && Array.isArray(args) && args.length === 2) {
            return `${this.valueToSource(args[0], 'argument')} == ${this.valueToSource(args[1], 'argument')}`;
          }
          
          // Special handling for And - output as && operator
          if (funcName === 'And' && Array.isArray(args)) {
            return args.map((a: any) => this.valueToSource(a, 'argument')).join(' && ');
          }
          
          // Special handling for Or - output as || operator
          if (funcName === 'Or' && Array.isArray(args)) {
            return args.map((a: any) => this.valueToSource(a, 'argument')).join(' || ');
          }
          
          // Special handling for Sub - preserve ${} syntax as-is
          if (funcName === 'Sub') {
            if (typeof args === 'string') {
              // Scalar form - just the template string
              // Escape special characters but preserve ${}
              const escaped = args
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
              return `${funcName}('${escaped}')`;
            } else if (Array.isArray(args)) {
              // Array form - template string and optional variables object
              const template = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
              const escaped = template
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
              if (args.length === 1) {
                return `${funcName}('${escaped}')`;
              } else {
                return `${funcName}('${escaped}', ${this.valueToSource(args[1], 'argument')})`;
              }
            }
          }
          
          // Special handling for different intrinsic formats
          if (Array.isArray(args)) {
            // Special case for If - first argument is a condition name (unquoted)
            if (funcName === 'If' && args.length >= 1) {
              const conditionName = typeof args[0] === 'string' ? args[0] : this.valueToSource(args[0], 'argument');
              const restArgs = args.slice(1).map((a: any) => this.valueToSource(a, 'argument'));
              return `${funcName}(${conditionName}, ${restArgs.join(', ')})`;
            }
            return `${funcName}(${args.map((a: any) => this.valueToSource(a, 'argument')).join(', ')})`;
          } else {
            return `${funcName}(${this.valueToSource(args, 'argument')})`;
          }
        }
      }
      
      return this.objectToSource(value);
    }
    
    return String(value);
  }
}
