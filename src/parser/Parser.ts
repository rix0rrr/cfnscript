import { Lexer } from '../lexer/Lexer';
import { Token, TokenType } from '../lexer/types';
import * as AST from '../ast/ASTNode';

export class Parser {
  private current: Token;
  private lexer: Lexer;

  constructor(source: string) {
    this.lexer = new Lexer(source);
    this.current = this.lexer.nextToken();
  }

  parse(): AST.TemplateNode {
    const statements: AST.ASTNode[] = [];
    
    while (this.current.type !== TokenType.EOF) {
      statements.push(this.parseStatement());
    }
    
    return new AST.TemplateNode(statements);
  }

  private parseStatement(): AST.ASTNode {
    // Check for special declarations
    if (this.current.type === TokenType.IDENTIFIER) {
      const name = this.current.value;
      
      // Check if it's a section declaration (no assignment)
      if (name === 'Description' || name === 'AWSTemplateFormatVersion' || 
          name === 'Transform' || name === 'Metadata' || name === 'Globals') {
        return this.parseSectionDeclaration(name);
      }
      
      // Otherwise it's an assignment
      return this.parseAssignment();
    }
    
    // Allow quoted strings as assignment targets
    if (this.current.type === TokenType.STRING) {
      return this.parseAssignment();
    }
    
    throw new Error(`Unexpected token at line ${this.current.line}: ${this.current.value}`);
  }

  private parseSectionDeclaration(name: string): AST.ASTNode {
    this.advance(); // Skip section name
    
    if (name === 'Description' || name === 'AWSTemplateFormatVersion') {
      const value = this.expect(TokenType.STRING).value;
      return name === 'Description' 
        ? new AST.DescriptionNode(value)
        : new AST.AWSTemplateFormatVersionNode(value);
    }
    
    if (name === 'Transform') {
      const value = this.parseExpression();
      return new AST.TransformNode(value.toCloudFormation());
    }
    
    // Metadata or Globals
    const value = this.parseExpression() as AST.ObjectNode;
    return name === 'Metadata' 
      ? new AST.MetadataNode(value)
      : new AST.GlobalsNode(value);
  }

  private parseAssignment(): AST.AssignmentNode {
    const name = this.current.type === TokenType.STRING 
      ? this.expect(TokenType.STRING).value
      : this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.EQUALS);
    const value = this.parseExpression();
    
    return new AST.AssignmentNode(name, value, this.current.line);
  }

  private parseExpression(): AST.ASTNode {
    // Parse || (lowest precedence)
    return this.parseOrExpression();
  }

  private parseOrExpression(): AST.ASTNode {
    let expr = this.parseAndExpression();
    
    // Handle || operator
    if (this.current.type === TokenType.DOUBLE_PIPE) {
      const conditions = [expr];
      while (this.current.type === TokenType.DOUBLE_PIPE) {
        this.advance();
        conditions.push(this.parseAndExpression());
      }
      return new AST.FunctionCallNode('Or', conditions);
    }
    
    return expr;
  }

  private parseAndExpression(): AST.ASTNode {
    let expr = this.parseEqualityExpression();
    
    // Handle && operator
    if (this.current.type === TokenType.DOUBLE_AMPERSAND) {
      const conditions = [expr];
      while (this.current.type === TokenType.DOUBLE_AMPERSAND) {
        this.advance();
        conditions.push(this.parseEqualityExpression());
      }
      return new AST.FunctionCallNode('And', conditions);
    }
    
    return expr;
  }

  private parseEqualityExpression(): AST.ASTNode {
    let expr = this.parseUnaryExpression();
    
    // Handle == operator
    if (this.current.type === TokenType.DOUBLE_EQUALS) {
      this.advance();
      const right = this.parseUnaryExpression();
      return new AST.FunctionCallNode('Equals', [expr, right]);
    }
    
    // Handle != operator (syntactic sugar for !(A == B))
    if (this.current.type === TokenType.EXCLAMATION_EQUALS) {
      this.advance();
      const right = this.parseUnaryExpression();
      const equals = new AST.FunctionCallNode('Equals', [expr, right]);
      return new AST.FunctionCallNode('Not', [equals]);
    }
    
    return expr;
  }

  private parseUnaryExpression(): AST.ASTNode {
    // Handle ! operator
    if (this.current.type === TokenType.EXCLAMATION) {
      this.advance();
      const operand = this.parseUnaryExpression();
      return new AST.FunctionCallNode('Not', [operand]);
    }
    
    return this.parseMemberExpression();
  }

  private parseMemberExpression(): AST.ASTNode {
    let expr = this.parsePrimary();
    
    // Handle member access and bracket notation
    while ((this.current.type as TokenType) === TokenType.DOT || (this.current.type as TokenType) === TokenType.LBRACKET) {
      if (this.current.type === TokenType.DOT) {
        this.advance();
        const property = this.expect(TokenType.IDENTIFIER).value;
        
        // Special case: AWS.Property becomes an identifier AWS::Property (which compiles to Ref)
        if (expr instanceof AST.IdentifierNode && expr.name === 'AWS') {
          return new AST.IdentifierNode(`AWS::${property}`);
        }
        
        expr = new AST.MemberAccessNode(expr, property);
      } else {
        // Bracket notation: Resource["Prop1", "Prop2"]
        this.advance(); // Skip [
        const properties: string[] = [];
        
        properties.push(this.expect(TokenType.STRING).value);
        while ((this.current.type as TokenType) === TokenType.COMMA) {
          this.advance();
          properties.push(this.expect(TokenType.STRING).value);
        }
        
        this.expect(TokenType.RBRACKET);
        
        // Create a GetAttArrayNode
        expr = new AST.GetAttArrayNode(expr, properties);
      }
    }
    
    return expr;
  }

  private parsePrimary(): AST.ASTNode {
    // String literal
    if (this.current.type === TokenType.STRING) {
      const value = this.current.value;
      this.advance();
      return new AST.LiteralNode(value);
    }
    
    // Number literal
    if (this.current.type === TokenType.NUMBER) {
      const value = parseFloat(this.current.value);
      this.advance();
      return new AST.LiteralNode(value);
    }
    
    // Parenthesized expression
    if (this.current.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN);
      return expr;
    }
    
    // Object literal
    if (this.current.type === TokenType.LBRACE) {
      return this.parseObject();
    }
    
    // Array literal
    if (this.current.type === TokenType.LBRACKET) {
      return this.parseArray();
    }
    
    // Identifier or function call
    if (this.current.type === TokenType.IDENTIFIER) {
      const name = this.current.value;
      this.advance();
      
      // Handle boolean and null literals
      if (name === 'true') return new AST.LiteralNode(true);
      if (name === 'false') return new AST.LiteralNode(false);
      if (name === 'null') return new AST.LiteralNode(null);
      
      // Check for entity declarations (Resource, Parameter, etc.)
      if (['Resource', 'Parameter', 'Output', 'Mapping', 'Condition', 'Rule'].includes(name)) {
        return this.parseEntityDeclaration(name);
      }
      
      // Use peek to avoid type narrowing issues
      if ((this.current.type as TokenType) === TokenType.LPAREN) {
        return this.parseFunctionCall(name);
      }
      
      return new AST.IdentifierNode(name);
    }
    
    throw new Error(`Unexpected token at line ${this.current.line}: ${this.current.value}`);
  }

  private parseEntityDeclaration(name: string): AST.ASTNode {
    if (name === 'Resource') {
      return this.parseResource();
    }
    
    if (name === 'Condition') {
      return new AST.ConditionNode(this.parseExpression());
    }
    
    // Parameter, Output, Mapping, Rule
    const obj = this.parseObject();
    const nodeMap: Record<string, any> = {
      'Parameter': AST.ParameterNode,
      'Output': AST.OutputNode,
      'Mapping': AST.MappingNode,
      'Rule': AST.RuleNode
    };
    return new nodeMap[name](obj);
  }

  private parseResource(): AST.ResourceNode {
    const type = this.parseResourceType();
    const hasProperties = this.current.type === TokenType.LBRACE;
    const properties = hasProperties ? this.parseObject() : new AST.ObjectNode(new Map());
    const resource = new AST.ResourceNode(type, properties, hasProperties);
    
    // Parse chained attributes
    const validAttributes = ['DependsOn', 'Condition', 'DeletionPolicy', 'UpdateReplacePolicy', 
                            'CreationPolicy', 'UpdatePolicy', 'Metadata', 'Version'];
    
    while (this.current.type === TokenType.IDENTIFIER && validAttributes.includes(this.current.value)) {
      const attrName = this.current.value;
      this.advance();
      this.expect(TokenType.LPAREN);
      const attrValue = this.parseExpression();
      this.expect(TokenType.RPAREN);
      resource.attributes.push(new AST.ResourceAttributeNode(attrName, attrValue));
    }
    
    return resource;
  }

  private parseResourceType(): string {
    // Parse AWS::S3::Bucket style type
    const parts: string[] = [];
    
    if (this.current.type !== TokenType.IDENTIFIER) {
      throw new Error(`Expected resource type at line ${this.current.line}`);
    }
    
    parts.push(this.current.value);
    this.advance();
    
    while ((this.current.type as TokenType) === TokenType.DOUBLE_COLON) {
      this.advance();
      if (this.current.type !== TokenType.IDENTIFIER) {
        throw new Error(`Expected identifier after :: at line ${this.current.line}`);
      }
      parts.push(this.current.value);
      this.advance();
    }
    
    return parts.join('::');
  }

  private parseFunctionCall(name: string): AST.ASTNode {
    this.expect(TokenType.LPAREN);
    
    // Disallow deprecated function syntax
    const disallowedFunctions: Record<string, string> = {
      'Equals': 'Use == operator instead',
      'Or': 'Use || operator instead',
      'And': 'Use && operator instead',
      'Not': 'Use ! operator instead',
      'Ref': 'Use variable reference instead (e.g., MyBucket)',
      'GetAtt': 'Use dot notation instead (e.g., MyBucket.Arn)'
    };
    
    if (disallowedFunctions[name]) {
      throw new Error(
        `${name}() function syntax is not supported. ${disallowedFunctions[name]} at line ${this.current.line}`
      );
    }
    
    const args: AST.ASTNode[] = [];
    
    if (this.current.type !== TokenType.RPAREN) {
      args.push(this.parseExpression());
      
      while (this.current.type === TokenType.COMMA) {
        this.advance();
        args.push(this.parseExpression());
      }
    }
    
    this.expect(TokenType.RPAREN);
    return new AST.FunctionCallNode(name, args);
  }

  private parseObject(): AST.ObjectNode {
    this.expect(TokenType.LBRACE);
    
    const properties = new Map<string, AST.ASTNode>();
    
    if (this.current.type !== TokenType.RBRACE) {
      do {
        if (this.current.type === TokenType.COMMA) {
          this.advance();
        }
        
        const key = this.current.type === TokenType.STRING 
          ? this.expect(TokenType.STRING).value
          : this.expect(TokenType.IDENTIFIER).value;
        
        this.expect(TokenType.COLON);
        const value = this.parseExpression();
        properties.set(key, value);
        
      } while (this.current.type === TokenType.COMMA);
    }
    
    this.expect(TokenType.RBRACE);
    return new AST.ObjectNode(properties);
  }

  private parseArray(): AST.ArrayNode {
    this.expect(TokenType.LBRACKET);
    
    const elements: AST.ASTNode[] = [];
    
    if (this.current.type !== TokenType.RBRACKET) {
      elements.push(this.parseExpression());
      
      while (this.current.type === TokenType.COMMA) {
        this.advance();
        if ((this.current.type as TokenType) === TokenType.RBRACKET) break;
        elements.push(this.parseExpression());
      }
    }
    
    this.expect(TokenType.RBRACKET);
    return new AST.ArrayNode(elements);
  }

  private advance(): void {
    this.current = this.lexer.nextToken();
  }

  private expect(type: TokenType): Token {
    if (this.current.type !== type) {
      throw new Error(
        `Expected ${TokenType[type]} but got ${TokenType[this.current.type]} ` +
        `at line ${this.current.line}, column ${this.current.column}`
      );
    }
    const token = this.current;
    this.advance();
    return token;
  }
}
