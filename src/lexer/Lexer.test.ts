import { Lexer } from './Lexer';
import { TokenType } from './types';

describe('Lexer', () => {
  describe('single character tokens', () => {
    it('should tokenize operators and punctuation', () => {
      const lexer = new Lexer('= ( ) { } [ ] , . :');
      expect(lexer.nextToken().type).toBe(TokenType.EQUALS);
      expect(lexer.nextToken().type).toBe(TokenType.LPAREN);
      expect(lexer.nextToken().type).toBe(TokenType.RPAREN);
      expect(lexer.nextToken().type).toBe(TokenType.LBRACE);
      expect(lexer.nextToken().type).toBe(TokenType.RBRACE);
      expect(lexer.nextToken().type).toBe(TokenType.LBRACKET);
      expect(lexer.nextToken().type).toBe(TokenType.RBRACKET);
      expect(lexer.nextToken().type).toBe(TokenType.COMMA);
      expect(lexer.nextToken().type).toBe(TokenType.DOT);
      expect(lexer.nextToken().type).toBe(TokenType.COLON);
      expect(lexer.nextToken().type).toBe(TokenType.EOF);
    });
  });

  describe('identifiers', () => {
    it('should tokenize identifiers', () => {
      const lexer = new Lexer('MyBucket Resource Parameter');
      const token1 = lexer.nextToken();
      expect(token1.type).toBe(TokenType.IDENTIFIER);
      expect(token1.value).toBe('MyBucket');

      const token2 = lexer.nextToken();
      expect(token2.type).toBe(TokenType.IDENTIFIER);
      expect(token2.value).toBe('Resource');

      const token3 = lexer.nextToken();
      expect(token3.type).toBe(TokenType.IDENTIFIER);
      expect(token3.value).toBe('Parameter');
    });

    it('should handle identifiers with underscores and numbers', () => {
      const lexer = new Lexer('my_var_123');
      const token = lexer.nextToken();
      expect(token.type).toBe(TokenType.IDENTIFIER);
      expect(token.value).toBe('my_var_123');
    });
  });

  describe('strings', () => {
    it('should tokenize double-quoted strings', () => {
      const lexer = new Lexer('"hello world"');
      const token = lexer.nextToken();
      expect(token.type).toBe(TokenType.STRING);
      expect(token.value).toBe('hello world');
    });

    it('should tokenize single-quoted strings', () => {
      const lexer = new Lexer("'hello world'");
      const token = lexer.nextToken();
      expect(token.type).toBe(TokenType.STRING);
      expect(token.value).toBe('hello world');
    });

    it('should handle escape sequences', () => {
      const lexer = new Lexer('"hello\\nworld\\t\\"test\\""');
      const token = lexer.nextToken();
      expect(token.type).toBe(TokenType.STRING);
      expect(token.value).toBe('hello\nworld\t"test"');
    });

    it('should throw on unterminated strings', () => {
      const lexer = new Lexer('"unterminated');
      expect(() => lexer.nextToken()).toThrow('Unterminated string');
    });
  });

  describe('numbers', () => {
    it('should tokenize integers', () => {
      const lexer = new Lexer('123 456');
      const token1 = lexer.nextToken();
      expect(token1.type).toBe(TokenType.NUMBER);
      expect(token1.value).toBe('123');

      const token2 = lexer.nextToken();
      expect(token2.type).toBe(TokenType.NUMBER);
      expect(token2.value).toBe('456');
    });

    it('should tokenize floats', () => {
      const lexer = new Lexer('3.14 2.718');
      const token1 = lexer.nextToken();
      expect(token1.type).toBe(TokenType.NUMBER);
      expect(token1.value).toBe('3.14');

      const token2 = lexer.nextToken();
      expect(token2.type).toBe(TokenType.NUMBER);
      expect(token2.value).toBe('2.718');
    });

    it('should tokenize negative numbers', () => {
      const lexer = new Lexer('-42 -3.14');
      const token1 = lexer.nextToken();
      expect(token1.type).toBe(TokenType.NUMBER);
      expect(token1.value).toBe('-42');

      const token2 = lexer.nextToken();
      expect(token2.type).toBe(TokenType.NUMBER);
      expect(token2.value).toBe('-3.14');
    });
  });

  describe('comments', () => {
    it('should skip # comments', () => {
      const lexer = new Lexer('MyBucket # this is a comment\nResource');
      const token1 = lexer.nextToken();
      expect(token1.type).toBe(TokenType.IDENTIFIER);
      expect(token1.value).toBe('MyBucket');

      const token2 = lexer.nextToken();
      expect(token2.type).toBe(TokenType.IDENTIFIER);
      expect(token2.value).toBe('Resource');
    });

    it('should skip // comments', () => {
      const lexer = new Lexer('MyBucket // this is a comment\nResource');
      const token1 = lexer.nextToken();
      expect(token1.type).toBe(TokenType.IDENTIFIER);
      expect(token1.value).toBe('MyBucket');

      const token2 = lexer.nextToken();
      expect(token2.type).toBe(TokenType.IDENTIFIER);
      expect(token2.value).toBe('Resource');
    });
  });

  describe('line and column tracking', () => {
    it('should track line and column numbers', () => {
      const lexer = new Lexer('MyBucket\n  Resource');
      const token1 = lexer.nextToken();
      expect(token1.line).toBe(1);
      expect(token1.column).toBe(1);

      const token2 = lexer.nextToken();
      expect(token2.line).toBe(2);
      expect(token2.column).toBe(3);
    });
  });

  describe('peek', () => {
    it('should peek without consuming token', () => {
      const lexer = new Lexer('MyBucket Resource');
      const peeked = lexer.peek();
      expect(peeked.type).toBe(TokenType.IDENTIFIER);
      expect(peeked.value).toBe('MyBucket');

      const token = lexer.nextToken();
      expect(token.type).toBe(TokenType.IDENTIFIER);
      expect(token.value).toBe('MyBucket');
    });
  });

  describe('complex expressions', () => {
    it('should tokenize resource declaration', () => {
      const lexer = new Lexer('MyBucket = Resource("AWS::S3::Bucket", { BucketName: "my-bucket" })');
      expect(lexer.nextToken().value).toBe('MyBucket');
      expect(lexer.nextToken().type).toBe(TokenType.EQUALS);
      expect(lexer.nextToken().value).toBe('Resource');
      expect(lexer.nextToken().type).toBe(TokenType.LPAREN);
      expect(lexer.nextToken().value).toBe('AWS::S3::Bucket');
      expect(lexer.nextToken().type).toBe(TokenType.COMMA);
      expect(lexer.nextToken().type).toBe(TokenType.LBRACE);
      expect(lexer.nextToken().value).toBe('BucketName');
      expect(lexer.nextToken().type).toBe(TokenType.COLON);
      expect(lexer.nextToken().value).toBe('my-bucket');
      expect(lexer.nextToken().type).toBe(TokenType.RBRACE);
      expect(lexer.nextToken().type).toBe(TokenType.RPAREN);
      expect(lexer.nextToken().type).toBe(TokenType.EOF);
    });
  });
});
