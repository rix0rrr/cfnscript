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
    this.expect(TokenType.LPAREN);
    
    if (name === 'Description' || name === 'AWSTemplateFormatVersion') {
      const value = this.expect(TokenType.STRING).value;
      this.expect(TokenType.RPAREN);
      return name === 'Description' 
        ? new AST.DescriptionNode(value)
        : new AST.AWSTemplateFormatVersionNode(value);
    } else if (name === 'Transform') {
      const value = this.parseExpression();
      this.expect(TokenType.RPAREN);
      const cfValue = value.toCloudFormation();
      return new AST.TransformNode(cfValue);
    } else if (name === 'Metadata' || name === 'Globals') {
      const value = this.parseExpression() as AST.ObjectNode;
      this.expect(TokenType.RPAREN);
      return name === 'Metadata' 
        ? new AST.MetadataNode(value)
        : new AST.GlobalsNode(value);
    }
    
    throw new Error(`Unknown section: ${name}`);
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
    
    // Handle member access
    while (this.current.type === TokenType.DOT) {
      this.advance();
      const property = this.expect(TokenType.IDENTIFIER).value;
      
      // Special case: AWS.Property becomes Ref('AWS::Property')
      if (expr instanceof AST.IdentifierNode && expr.name === 'AWS') {
        return new AST.FunctionCallNode('Ref', [new AST.LiteralNode(`AWS::${property}`)]);
      }
      
      expr = new AST.MemberAccessNode(expr, property);
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
      // Parse: Resource AWS::S3::Bucket { ... } or Resource AWS::S3::Bucket
      const type = this.parseResourceType();
      
      // Check if there's a properties object
      const hasProperties = this.current.type === TokenType.LBRACE;
      const properties = hasProperties ? this.parseObject() : new AST.ObjectNode(new Map());
      const resource = new AST.ResourceNode(type, properties, hasProperties);
      
      // Parse chained attributes
      while (this.current.type === TokenType.IDENTIFIER) {
        const attrName = this.current.value;
        if (['DependsOn', 'Condition', 'DeletionPolicy', 'UpdateReplacePolicy', 
             'CreationPolicy', 'UpdatePolicy', 'Metadata', 'Version'].includes(attrName)) {
          this.advance();
          this.expect(TokenType.LPAREN);
          const attrValue = this.parseExpression();
          this.expect(TokenType.RPAREN);
          resource.attributes.push(new AST.ResourceAttributeNode(attrName, attrValue));
        } else {
          break;
        }
      }
      
      return resource;
    } else if (name === 'Parameter' || name === 'Output' || name === 'Mapping' || name === 'Rule') {
      // Parse: Parameter { ... }
      const obj = this.parseObject();
      if (name === 'Parameter') return new AST.ParameterNode(obj);
      if (name === 'Output') return new AST.OutputNode(obj);
      if (name === 'Mapping') return new AST.MappingNode(obj);
      return new AST.RuleNode(obj);
    } else if (name === 'Condition') {
      // Parse: Condition expression
      const expr = this.parseExpression();
      return new AST.ConditionNode(expr);
    }
    
    throw new Error(`Unknown entity type: ${name}`);
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
    
    // Disallow deprecated function syntax for operators
    if (name === 'Equals' || name === 'Or' || name === 'And' || name === 'Not') {
      const operator = name === 'Equals' ? '==' : name === 'Or' ? '||' : name === 'And' ? '&&' : '!';
      throw new Error(
        `${name}() function syntax is not supported. Use operators instead: ` +
        `${operator} at line ${this.current.line}`
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
    
    // Special handling for Sub - preserve string format
    if (name === 'Sub') {
      return new AST.FunctionCallNode(name, args);
    }
    
    // Regular function call (intrinsic)
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
