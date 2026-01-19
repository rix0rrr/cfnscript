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
          name === 'Transform' || name === 'Metadata') {
        return this.parseSectionDeclaration(name);
      }
      
      // Otherwise it's an assignment
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
    } else if (name === 'Metadata') {
      const value = this.parseExpression() as AST.ObjectNode;
      this.expect(TokenType.RPAREN);
      return new AST.MetadataNode(value);
    }
    
    throw new Error(`Unknown section: ${name}`);
  }

  private parseAssignment(): AST.AssignmentNode {
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.EQUALS);
    const value = this.parseExpression();
    
    return new AST.AssignmentNode(name, value, this.current.line);
  }

  private parseExpression(): AST.ASTNode {
    let expr = this.parsePrimary();
    
    // Handle member access
    while (this.current.type === TokenType.DOT) {
      this.advance();
      const property = this.expect(TokenType.IDENTIFIER).value;
      expr = new AST.MemberAccessNode(expr, property);
    }
    
    return expr;
  }

  private parsePrimary(): AST.ASTNode {
    // String literal
    if (this.current.type === TokenType.STRING) {
      const value = this.current.value;
      this.advance();
      
      // Check if it's an AWS pseudo-parameter (not a resource type)
      // Pseudo-parameters: AWS::AccountId, AWS::NoValue, AWS::NotificationARNs, AWS::Partition, AWS::Region, AWS::StackId, AWS::StackName, AWS::URLSuffix
      const pseudoParams = ['AWS::AccountId', 'AWS::NoValue', 'AWS::NotificationARNs', 'AWS::Partition', 'AWS::Region', 'AWS::StackId', 'AWS::StackName', 'AWS::URLSuffix'];
      if (pseudoParams.includes(value)) {
        return new AST.FunctionCallNode('Ref', [new AST.LiteralNode(value)]);
      }
      
      return new AST.LiteralNode(value);
    }
    
    // Number literal
    if (this.current.type === TokenType.NUMBER) {
      const value = parseFloat(this.current.value);
      this.advance();
      return new AST.LiteralNode(value);
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
      
      // Use peek to avoid type narrowing issues
      if ((this.current.type as TokenType) === TokenType.LPAREN) {
        return this.parseFunctionCall(name);
      }
      
      return new AST.IdentifierNode(name);
    }
    
    throw new Error(`Unexpected token at line ${this.current.line}: ${this.current.value}`);
  }

  private parseFunctionCall(name: string): AST.ASTNode {
    this.expect(TokenType.LPAREN);
    
    const args: AST.ASTNode[] = [];
    
    if (this.current.type !== TokenType.RPAREN) {
      args.push(this.parseExpression());
      
      while (this.current.type === TokenType.COMMA) {
        this.advance();
        args.push(this.parseExpression());
      }
    }
    
    this.expect(TokenType.RPAREN);
    
    // Handle special section constructors
    if (name === 'Resource') {
      const type = args[0].toCloudFormation();
      const properties = args[1] as AST.ObjectNode;
      const resource = new AST.ResourceNode(type, properties);
      
      // Parse chained attributes
      while (this.current.type === TokenType.IDENTIFIER) {
        const attrName = this.current.value;
        if (['DependsOn', 'Condition', 'DeletionPolicy', 'UpdateReplacePolicy', 
             'CreationPolicy', 'UpdatePolicy', 'Metadata'].includes(attrName)) {
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
    } else if (name === 'Parameter') {
      return new AST.ParameterNode(args[0] as AST.ObjectNode);
    } else if (name === 'Output') {
      return new AST.OutputNode(args[0] as AST.ObjectNode);
    } else if (name === 'Mapping') {
      return new AST.MappingNode(args[0] as AST.ObjectNode);
    } else if (name === 'Condition') {
      return new AST.ConditionNode(args[0]);
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
