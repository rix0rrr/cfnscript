export abstract class ASTNode {
  abstract toCloudFormation(): any;
  abstract toSource(): string;
}

export class LiteralNode extends ASTNode {
  constructor(public value: string | number | boolean | null) {
    super();
  }

  toCloudFormation(): any {
    return this.value;
  }

  toSource(): string {
    if (this.value === null) {
      return 'null';
    }
    if (typeof this.value === 'string') {
      return `"${this.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return String(this.value);
  }
}

export class IdentifierNode extends ASTNode {
  constructor(public name: string) {
    super();
  }

  toCloudFormation(): any {
    return { Ref: this.name };
  }

  toSource(): string {
    return this.name;
  }
}

export class ObjectNode extends ASTNode {
  constructor(public properties: Map<string, ASTNode>) {
    super();
  }

  toCloudFormation(): any {
    const result: Record<string, any> = {};
    for (const [key, value] of this.properties) {
      result[key] = value.toCloudFormation();
    }
    return result;
  }

  toSource(): string {
    const props = Array.from(this.properties.entries())
      .map(([key, value]) => `${key}: ${value.toSource()}`)
      .join(', ');
    return `{ ${props} }`;
  }
}

export class ArrayNode extends ASTNode {
  constructor(public elements: ASTNode[]) {
    super();
  }

  toCloudFormation(): any {
    return this.elements.map(el => el.toCloudFormation());
  }

  toSource(): string {
    const elements = this.elements.map(el => el.toSource()).join(', ');
    return `[${elements}]`;
  }
}

export class MemberAccessNode extends ASTNode {
  constructor(public object: ASTNode, public property: string) {
    super();
  }

  toCloudFormation(): any {
    if (this.object instanceof IdentifierNode) {
      return { 'Fn::GetAtt': [this.object.name, this.property] };
    }
    throw new Error('Member access only supported on identifiers');
  }

  toSource(): string {
    return `${this.object.toSource()}.${this.property}`;
  }
}

export class FunctionCallNode extends ASTNode {
  constructor(public name: string, public args: ASTNode[]) {
    super();
  }

  toCloudFormation(): any {
    if (this.name === 'Ref') {
      return { Ref: this.args[0].toCloudFormation() };
    }
    
    // Special handling for If - first argument is a condition name (string, not Ref)
    if (this.name === 'If' && this.args.length >= 1) {
      const firstArg = this.args[0];
      let conditionName: string;
      
      if (firstArg instanceof IdentifierNode) {
        conditionName = firstArg.name;
      } else {
        conditionName = firstArg.toCloudFormation();
      }
      
      const restArgs = this.args.slice(1).map(arg => arg.toCloudFormation());
      return { [`Fn::${this.name}`]: [conditionName, ...restArgs] };
    }
    
    // Special handling for Sub - preserve string format
    if (this.name === 'Sub') {
      const cfArgs = this.args.map(arg => arg.toCloudFormation());
      // If only one argument (the template string), return as scalar
      if (cfArgs.length === 1) {
        return { [`Fn::${this.name}`]: cfArgs[0] };
      }
      // Otherwise return as array
      return { [`Fn::${this.name}`]: cfArgs };
    }
    
    return { [`Fn::${this.name}`]: this.args.map(arg => arg.toCloudFormation()) };
  }

  toSource(): string {
    const args = this.args.map(arg => arg.toSource()).join(', ');
    return `${this.name}(${args})`;
  }
}

export class ResourceNode extends ASTNode {
  constructor(
    public type: string,
    public properties: ObjectNode,
    public attributes: ResourceAttributeNode[] = []
  ) {
    super();
  }

  toCloudFormation(): any {
    const result: any = {
      Type: this.type,
      Properties: this.properties.toCloudFormation()
    };
    
    for (const attr of this.attributes) {
      const [key, value] = attr.toCloudFormation();
      result[key] = value;
    }
    
    return result;
  }

  toSource(): string {
    let result = `Resource("${this.type}", ${this.properties.toSource()})`;
    for (const attr of this.attributes) {
      result += ` ${attr.toSource()}`;
    }
    return result;
  }
}

export class ResourceAttributeNode extends ASTNode {
  constructor(public name: string, public value: ASTNode) {
    super();
  }

  toCloudFormation(): [string, any] {
    let cfValue = this.value.toCloudFormation();
    
    // For Condition and DependsOn, if the value is a Ref, unwrap it to just the string
    if ((this.name === 'Condition' || this.name === 'DependsOn') && 
        cfValue && typeof cfValue === 'object' && cfValue.Ref) {
      cfValue = cfValue.Ref;
    }
    
    return [this.name, cfValue];
  }

  toSource(): string {
    return `${this.name}(${this.value.toSource()})`;
  }
}

export class ParameterNode extends ASTNode {
  constructor(public properties: ObjectNode) {
    super();
  }

  toCloudFormation(): any {
    return this.properties.toCloudFormation();
  }

  toSource(): string {
    return `Parameter(${this.properties.toSource()})`;
  }
}

export class OutputNode extends ASTNode {
  constructor(public properties: ObjectNode) {
    super();
  }

  toCloudFormation(): any {
    return this.properties.toCloudFormation();
  }

  toSource(): string {
    return `Output(${this.properties.toSource()})`;
  }
}

export class MappingNode extends ASTNode {
  constructor(public value: ObjectNode) {
    super();
  }

  toCloudFormation(): any {
    return this.value.toCloudFormation();
  }

  toSource(): string {
    return `Mapping(${this.value.toSource()})`;
  }
}

export class ConditionNode extends ASTNode {
  constructor(public expression: ASTNode) {
    super();
  }

  toCloudFormation(): any {
    return this.expression.toCloudFormation();
  }

  toSource(): string {
    return `Condition(${this.expression.toSource()})`;
  }
}

export class AssignmentNode extends ASTNode {
  constructor(public name: string, public value: ASTNode, public line: number = 0) {
    super();
  }

  toCloudFormation(): any {
    return this.value.toCloudFormation();
  }

  toSource(): string {
    return `${this.name} = ${this.value.toSource()}`;
  }
}

export class DescriptionNode extends ASTNode {
  constructor(public value: string) {
    super();
  }

  toCloudFormation(): any {
    return this.value;
  }

  toSource(): string {
    return `Description("${this.value}")`;
  }
}

export class AWSTemplateFormatVersionNode extends ASTNode {
  constructor(public value: string) {
    super();
  }

  toCloudFormation(): any {
    return this.value;
  }

  toSource(): string {
    return `AWSTemplateFormatVersion("${this.value}")`;
  }
}

export class TransformNode extends ASTNode {
  constructor(public value: string | string[]) {
    super();
  }

  toCloudFormation(): any {
    return this.value;
  }

  toSource(): string {
    if (Array.isArray(this.value)) {
      return `Transform([${this.value.map(v => `"${v}"`).join(', ')}])`;
    }
    return `Transform("${this.value}")`;
  }
}

export class MetadataNode extends ASTNode {
  constructor(public value: ObjectNode) {
    super();
  }

  toCloudFormation(): any {
    return this.value.toCloudFormation();
  }

  toSource(): string {
    return `Metadata(${this.value.toSource()})`;
  }
}

export class TemplateNode extends ASTNode {
  constructor(public statements: ASTNode[]) {
    super();
  }

  toCloudFormation(): any {
    const template: any = { Resources: {} };
    
    for (const stmt of this.statements) {
      if (stmt instanceof AssignmentNode) {
        const value = stmt.value;
        if (value instanceof ResourceNode) {
          template.Resources[stmt.name] = value.toCloudFormation();
        } else if (value instanceof ParameterNode) {
          template.Parameters = template.Parameters || {};
          template.Parameters[stmt.name] = value.toCloudFormation();
        } else if (value instanceof OutputNode) {
          template.Outputs = template.Outputs || {};
          template.Outputs[stmt.name] = value.toCloudFormation();
        } else if (value instanceof MappingNode) {
          template.Mappings = template.Mappings || {};
          template.Mappings[stmt.name] = value.toCloudFormation();
        } else if (value instanceof ConditionNode) {
          template.Conditions = template.Conditions || {};
          template.Conditions[stmt.name] = value.toCloudFormation();
        }
      } else if (stmt instanceof DescriptionNode) {
        template.Description = stmt.toCloudFormation();
      } else if (stmt instanceof AWSTemplateFormatVersionNode) {
        template.AWSTemplateFormatVersion = stmt.toCloudFormation();
      } else if (stmt instanceof TransformNode) {
        template.Transform = stmt.toCloudFormation();
      } else if (stmt instanceof MetadataNode) {
        template.Metadata = stmt.toCloudFormation();
      }
    }
    
    return template;
  }

  toSource(): string {
    return this.statements.map(stmt => stmt.toSource()).join('\n\n');
  }
}
