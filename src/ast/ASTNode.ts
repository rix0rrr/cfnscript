export interface CompilationContext {
  parameters: Set<string>;
  conditions: Set<string>;
  resources: Set<string>;
  mappings: Set<string>;
}

export abstract class ASTNode {
  abstract toCloudFormation(): any;
  toCloudFormationWithContext(context: CompilationContext): any {
    return this.toCloudFormation();
  }
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
  
  toCloudFormationWithContext(context: CompilationContext): any {
    if (!this.isAWSPseudoParameter()) {
      this.validateDeclared(context);
    }
    
    // Parameters and resources use Ref, conditions use Condition
    // Parameters take precedence when there's a name collision
    if (context.conditions.has(this.name) && !context.parameters.has(this.name)) {
      return { Condition: this.name };
    }
    return { Ref: this.name };
  }

  private isAWSPseudoParameter(): boolean {
    return this.name.startsWith('AWS::') || this.name.startsWith('AWS.');
  }

  private validateDeclared(context: CompilationContext): void {
    const isDeclared = context.parameters.has(this.name) || 
                      context.conditions.has(this.name) ||
                      context.resources.has(this.name) ||
                      context.mappings.has(this.name);
    
    if (!isDeclared) {
      throw new Error(`Identifier '${this.name}' is not declared`);
    }
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
  
  toCloudFormationWithContext(context: CompilationContext): any {
    const result: Record<string, any> = {};
    for (const [key, value] of this.properties) {
      result[key] = value.toCloudFormationWithContext(context);
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
  
  toCloudFormationWithContext(context: CompilationContext): any {
    return this.elements.map(el => el.toCloudFormationWithContext(context));
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
    // Collect all chained properties
    let current: ASTNode = this;
    const properties: string[] = [];
    
    while (current instanceof MemberAccessNode) {
      properties.unshift(current.property);
      current = current.object;
    }
    
    if (current instanceof IdentifierNode) {
      const attributePath = properties.join('.');
      return { 'Fn::GetAtt': [current.name, attributePath] };
    }
    
    throw new Error('Member access only supported on identifiers');
  }

  toSource(): string {
    return `${this.object.toSource()}.${this.property}`;
  }
}

export class GetAttArrayNode extends ASTNode {
  constructor(public object: ASTNode, public properties: string[]) {
    super();
  }

  toCloudFormation(): any {
    if (this.object instanceof IdentifierNode) {
      return { 'Fn::GetAtt': [this.object.name, ...this.properties] };
    }
    throw new Error('GetAtt array notation only supported on identifiers');
  }

  toSource(): string {
    const props = this.properties.map(p => `"${p}"`).join(', ');
    return `${this.object.toSource()}[${props}]`;
  }
}

export class FunctionCallNode extends ASTNode {
  constructor(public name: string, public args: ASTNode[]) {
    super();
  }

  toCloudFormation(): any {
    return this.toCloudFormationWithContext({ 
      parameters: new Set(), 
      conditions: new Set(),
      resources: new Set(),
      mappings: new Set()
    });
  }
  
  toCloudFormationWithContext(context: CompilationContext): any {
    if (this.name === 'If') {
      return this.buildIfFunction(context);
    }
    
    if (this.name === 'Sub') {
      return this.buildSubFunction(context);
    }
    
    return this.buildGenericFunction(context);
  }

  private buildIfFunction(context: CompilationContext): any {
    const firstArg = this.args[0];
    const conditionName = firstArg instanceof IdentifierNode 
      ? firstArg.name 
      : firstArg.toCloudFormationWithContext(context);
    
    const restArgs = this.args.slice(1).map(arg => arg.toCloudFormationWithContext(context));
    return { [`Fn::${this.name}`]: [conditionName, ...restArgs] };
  }

  private buildSubFunction(context: CompilationContext): any {
    const cfArgs = this.args.map(arg => arg.toCloudFormationWithContext(context));
    return { [`Fn::${this.name}`]: cfArgs.length === 1 ? cfArgs[0] : cfArgs };
  }

  private buildGenericFunction(context: CompilationContext): any {
    const alwaysArrayFunctions = ['Not', 'And', 'Or', 'Equals', 'Join', 'Split', 'Select', 'FindInMap', 'Cidr'];
    const cfArgs = this.args.map(arg => arg.toCloudFormationWithContext(context));
    
    const useArray = alwaysArrayFunctions.includes(this.name) || cfArgs.length > 1;
    return { [`Fn::${this.name}`]: useArray ? cfArgs : cfArgs[0] };
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
    public hasExplicitProperties: boolean = true,
    public attributes: ResourceAttributeNode[] = []
  ) {
    super();
  }

  toCloudFormation(): any {
    return this.buildResource(ctx => this.properties.toCloudFormation());
  }

  toCloudFormationWithContext(context: CompilationContext): any {
    return this.buildResource(ctx => this.properties.toCloudFormationWithContext(context), context);
  }

  private buildResource(getProperties: (context?: CompilationContext) => any, context?: CompilationContext): any {
    const result: any = { Type: this.type };
    
    if (this.hasExplicitProperties) {
      result.Properties = getProperties(context);
    }
    
    for (const attr of this.attributes) {
      const [key, value] = context 
        ? attr.toCloudFormationWithContext(context)
        : attr.toCloudFormation();
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
    return [this.name, this.unwrapValue(this.value.toCloudFormation())];
  }

  toCloudFormationWithContext(context: CompilationContext): [string, any] {
    return [this.name, this.unwrapValue(this.value.toCloudFormationWithContext(context))];
  }

  private unwrapValue(cfValue: any): any {
    if ((this.name === 'Condition' || this.name === 'DependsOn') && 
        cfValue && typeof cfValue === 'object') {
      return cfValue.Ref || cfValue.Condition || cfValue;
    }
    return cfValue;
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

  toCloudFormationWithContext(context: CompilationContext): any {
    return this.properties.toCloudFormationWithContext(context);
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

  toCloudFormationWithContext(context: CompilationContext): any {
    return this.properties.toCloudFormationWithContext(context);
  }

  toSource(): string {
    return `Output(${this.properties.toSource()})`;
  }
}

export class RuleNode extends ASTNode {
  constructor(public properties: ObjectNode) {
    super();
  }

  toCloudFormation(): any {
    return this.properties.toCloudFormation();
  }

  toCloudFormationWithContext(context: CompilationContext): any {
    return this.properties.toCloudFormationWithContext(context);
  }

  toSource(): string {
    return `Rule(${this.properties.toSource()})`;
  }
}

export class MappingNode extends ASTNode {
  constructor(public value: ObjectNode) {
    super();
  }

  toCloudFormation(): any {
    return this.value.toCloudFormation();
  }

  toCloudFormationWithContext(context: CompilationContext): any {
    return this.value.toCloudFormationWithContext(context);
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
  
  toCloudFormationWithContext(context: CompilationContext): any {
    return this.expression.toCloudFormationWithContext(context);
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
    return `Description "${this.value}"`;
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
    return `AWSTemplateFormatVersion "${this.value}"`;
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
      return `Transform [${this.value.map(v => `"${v}"`).join(', ')}]`;
    }
    return `Transform "${this.value}"`;
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
    return `Metadata ${this.value.toSource()}`;
  }
}

export class GlobalsNode extends ASTNode {
  constructor(public value: ObjectNode) {
    super();
  }

  toCloudFormation(): any {
    return this.value.toCloudFormation();
  }

  toSource(): string {
    return `Globals ${this.value.toSource()}`;
  }
}

export class TemplateNode extends ASTNode {
  constructor(public statements: ASTNode[]) {
    super();
  }

  toCloudFormation(): any {
    const template: any = { Resources: {} };
    const context = this.collectDeclarations();
    
    for (const stmt of this.statements) {
      if (stmt instanceof AssignmentNode) {
        this.addAssignmentToTemplate(template, stmt, context);
      } else {
        this.addTopLevelStatement(template, stmt);
      }
    }
    
    return template;
  }

  private collectDeclarations(): CompilationContext {
    const context = {
      parameters: new Set<string>(),
      conditions: new Set<string>(),
      resources: new Set<string>(),
      mappings: new Set<string>()
    };
    
    for (const stmt of this.statements) {
      if (stmt instanceof AssignmentNode) {
        const { name, value } = stmt;
        if (value instanceof ParameterNode) context.parameters.add(name);
        else if (value instanceof ConditionNode) context.conditions.add(name);
        else if (value instanceof ResourceNode) context.resources.add(name);
        else if (value instanceof MappingNode) context.mappings.add(name);
      }
    }
    
    return context;
  }

  private addAssignmentToTemplate(template: any, stmt: AssignmentNode, context: CompilationContext): void {
    const sections = [
      { type: ResourceNode, key: 'Resources' },
      { type: ParameterNode, key: 'Parameters' },
      { type: OutputNode, key: 'Outputs' },
      { type: RuleNode, key: 'Rules' },
      { type: MappingNode, key: 'Mappings' },
      { type: ConditionNode, key: 'Conditions' }
    ];
    
    for (const { type, key } of sections) {
      if (stmt.value instanceof type) {
        template[key] = template[key] || {};
        template[key][stmt.name] = stmt.value.toCloudFormationWithContext(context);
        return;
      }
    }
  }

  private addTopLevelStatement(template: any, stmt: ASTNode): void {
    if (stmt instanceof DescriptionNode) template.Description = stmt.toCloudFormation();
    else if (stmt instanceof AWSTemplateFormatVersionNode) template.AWSTemplateFormatVersion = stmt.toCloudFormation();
    else if (stmt instanceof TransformNode) template.Transform = stmt.toCloudFormation();
    else if (stmt instanceof MetadataNode) template.Metadata = stmt.toCloudFormation();
    else if (stmt instanceof GlobalsNode) template.Globals = stmt.toCloudFormation();
  }

  toSource(): string {
    return this.statements.map(stmt => stmt.toSource()).join('\n\n');
  }
}
