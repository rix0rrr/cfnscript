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
  
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
  
  decompile(template: CloudFormationTemplate): string {
    const lines: string[] = [];
    
    if (template.AWSTemplateFormatVersion) {
      lines.push(`AWSTemplateFormatVersion '${template.AWSTemplateFormatVersion}'`);
    }
    
    if (template.Description) {
      lines.push(`Description '${this.escapeString(template.Description)}'`);
    }
    
    if (template.Transform) {
      if (Array.isArray(template.Transform)) {
        lines.push(`Transform [${template.Transform.map(t => `'${t}'`).join(', ')}]`);
      } else {
        lines.push(`Transform '${template.Transform}'`);
      }
    }
    
    if (template.Metadata) {
      lines.push(`Metadata ${this.objectToSource(template.Metadata)}`);
    }
    
    if (template.Globals) {
      lines.push(`Globals ${this.objectToSource(template.Globals)}`);
    }
    
    if (template.Parameters) {
      for (const [name, param] of Object.entries(template.Parameters)) {
        lines.push(`${name} = Parameter ${this.objectToSource(param)}`);
      }
    }
    
    if (template.Mappings && Object.keys(template.Mappings).length > 0) {
      for (const [name, mapping] of Object.entries(template.Mappings)) {
        lines.push(`${name} = Mapping ${this.objectToSource(mapping)}`);
      }
    }
    
    if (template.Conditions) {
      for (const [name, condition] of Object.entries(template.Conditions)) {
        lines.push(`${name} = Condition ${this.valueToSource(condition)}`);
      }
    }
    
    if (template.Resources) {
      for (const [name, resource] of Object.entries(template.Resources)) {
        lines.push(this.resourceToSource(name, resource));
      }
    }
    
    if (template.Outputs) {
      for (const [name, output] of Object.entries(template.Outputs)) {
        lines.push(`${name} = Output ${this.objectToSource(output)}`);
      }
    }
    
    if (template.Rules) {
      for (const [name, rule] of Object.entries(template.Rules)) {
        lines.push(`${name} = Rule ${this.objectToSource(rule)}`);
      }
    }
    
    return this.printer.format(lines.join('\n\n'));
  }

  private resourceToSource(name: string, resource: any): string {
    let line: string;
    if (resource.Properties === undefined) {
      line = `${name} = Resource ${resource.Type}`;
    } else {
      line = `${name} = Resource ${resource.Type} ${this.objectToSource(resource.Properties)}`;
    }
    
    const attributes = [
      { key: 'DependsOn', formatter: (v: any) => Array.isArray(v) ? `[${v.map(d => `'${d}'`).join(', ')}]` : `'${v}'` },
      { key: 'Condition', formatter: (v: any) => v },
      { key: 'DeletionPolicy', formatter: (v: any) => `'${v}'` },
      { key: 'UpdateReplacePolicy', formatter: (v: any) => `'${v}'` },
      { key: 'Metadata', formatter: (v: any) => this.objectToSource(v) },
      { key: 'CreationPolicy', formatter: (v: any) => this.objectToSource(v) },
      { key: 'UpdatePolicy', formatter: (v: any) => this.objectToSource(v) },
      { key: 'Version', formatter: (v: any) => `'${v}'` }
    ];
    
    for (const { key, formatter } of attributes) {
      if (resource[key]) {
        line += ` ${key}(${formatter(resource[key])})`;
      }
    }
    
    return line;
  }

  private objectToSource(obj: Record<string, any>): string {
    const props = Object.entries(obj)
      .map(([key, value]) => `${this.quoteKeyIfNeeded(key)}: ${this.valueToSource(value)}`)
      .join(', ');
    return `{ ${props} }`;
  }

  private quoteKeyIfNeeded(key: string): string {
    const needsQuoting = /[.\-\s:\\]/.test(key) || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
    return needsQuoting ? `'${this.escapeString(key)}'` : key;
  }
  
  private valueToSource(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'string') {
      return `'${this.escapeString(value)}'`;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      return `[${value.map(v => this.valueToSource(v)).join(', ')}]`;
    }
    
    if (typeof value === 'object') {
      return this.objectValueToSource(value);
    }
    
    return String(value);
  }

  private objectValueToSource(value: any): string {
    // Check for Ref
    if (value.Ref) {
      if (value.Ref.startsWith('AWS::')) {
        return `AWS.${value.Ref.substring(5)}`;
      }
      return value.Ref;
    }
    
    // Check for GetAtt
    if (value['Fn::GetAtt']) {
      return this.getAttToSource(value['Fn::GetAtt']);
    }
    
    // Check for other intrinsic functions
    for (const key of Object.keys(value)) {
      if (key.startsWith('Fn::')) {
        return this.intrinsicToSource(key.substring(4), value[key]);
      }
    }
    
    return this.objectToSource(value);
  }

  private getAttToSource(attValue: any): string {
    if (Array.isArray(attValue) && attValue.length >= 2) {
      if (attValue.length === 2) {
        // 2-element form: use dot notation
        return `${attValue[0]}.${attValue[1]}`;
      } else {
        // 3+ element form: use bracket notation
        const props = attValue.slice(1).map((p: string) => `"${p}"`).join(', ');
        return `${attValue[0]}[${props}]`;
      }
    }
    throw new Error(`Invalid Fn::GetAtt format: ${JSON.stringify(attValue)}`);
  }

  private intrinsicToSource(funcName: string, args: any): string {
    // Operators
    if (funcName === 'Equals' && Array.isArray(args) && args.length === 2) {
      return `${this.valueToSource(args[0])} == ${this.valueToSource(args[1])}`;
    }
    
    if (funcName === 'And' && Array.isArray(args)) {
      return args.map((a: any) => this.valueToSource(a)).join(' && ');
    }
    
    if (funcName === 'Or' && Array.isArray(args)) {
      return args.map((a: any) => this.valueToSource(a)).join(' || ');
    }
    
    if (funcName === 'Not' && Array.isArray(args) && args.length === 1) {
      return this.notToSource(args[0]);
    }
    
    // Sub function
    if (funcName === 'Sub') {
      return this.subToSource(args);
    }
    
    // If function
    if (funcName === 'If' && Array.isArray(args) && args.length >= 1) {
      const conditionName = typeof args[0] === 'string' ? args[0] : this.valueToSource(args[0]);
      const restArgs = args.slice(1).map((a: any) => this.valueToSource(a));
      return `${funcName}(${conditionName}, ${restArgs.join(', ')})`;
    }
    
    // Generic function
    if (Array.isArray(args)) {
      return `${funcName}(${args.map((a: any) => this.valueToSource(a)).join(', ')})`;
    }
    return `${funcName}(${this.valueToSource(args)})`;
  }

  private notToSource(arg: any): string {
    // Check if it's Not(Equals(...)) - emit as !=
    if (arg && typeof arg === 'object' && arg['Fn::Equals'] && 
        Array.isArray(arg['Fn::Equals']) && arg['Fn::Equals'].length === 2) {
      const left = this.valueToSource(arg['Fn::Equals'][0]);
      const right = this.valueToSource(arg['Fn::Equals'][1]);
      return `${left} != ${right}`;
    }
    
    const operand = this.valueToSource(arg);
    if (operand.includes('==') || operand.includes('&&') || operand.includes('||')) {
      return `!(${operand})`;
    }
    return `!${operand}`;
  }

  private subToSource(args: any): string {
    if (typeof args === 'string') {
      return `Sub('${this.escapeString(args)}')`;
    }
    
    if (Array.isArray(args)) {
      const template = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
      const escaped = this.escapeString(template);
      if (args.length === 1) {
        return `Sub('${escaped}')`;
      }
      return `Sub('${escaped}', ${this.valueToSource(args[1])})`;
    }
    
    return `Sub(${this.valueToSource(args)})`;
  }
}
