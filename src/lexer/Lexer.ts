import { Token, TokenType } from './types';

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private current: string;

  constructor(source: string) {
    this.source = source;
    this.current = source[0] || '';
  }

  nextToken(): Token {
    this.skipWhitespaceAndComments();

    if (this.pos >= this.source.length) {
      return this.makeToken(TokenType.EOF, '');
    }

    const line = this.line;
    const column = this.column;

    // Two-character operators
    const doubleChar = this.tryDoubleChar(line, column);
    if (doubleChar) return doubleChar;

    // Single character tokens
    const singleCharTokens: Record<string, TokenType> = {
      '(': TokenType.LPAREN, ')': TokenType.RPAREN,
      '{': TokenType.LBRACE, '}': TokenType.RBRACE,
      '[': TokenType.LBRACKET, ']': TokenType.RBRACKET,
      ',': TokenType.COMMA, '.': TokenType.DOT
    };
    
    if (singleCharTokens[this.current]) {
      const char = this.current;
      this.advance();
      return this.makeToken(singleCharTokens[char], char, line, column);
    }

    // String literals
    if (this.current === '"' || this.current === "'") {
      return this.readString(line, column);
    }

    // Numbers
    if (this.isDigit(this.current) || (this.current === '-' && this.isDigit(this.peek1()))) {
      return this.readNumber(line, column);
    }

    // Identifiers
    if (this.isIdentifierStart(this.current)) {
      return this.readIdentifier(line, column);
    }

    throw new Error(`Unexpected character '${this.current}' at line ${line}, column ${column}`);
  }

  peek(): Token {
    const savedPos = this.pos;
    const savedLine = this.line;
    const savedColumn = this.column;
    const savedCurrent = this.current;

    const token = this.nextToken();

    this.pos = savedPos;
    this.line = savedLine;
    this.column = savedColumn;
    this.current = savedCurrent;

    return token;
  }

  private advance(): void {
    if (this.current === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.pos++;
    this.current = this.source[this.pos] || '';
  }

  private tryDoubleChar(line: number, column: number): Token | null {
    const doubleCharTokens: Record<string, [string, TokenType, TokenType]> = {
      '=': ['=', TokenType.DOUBLE_EQUALS, TokenType.EQUALS],
      '&': ['&', TokenType.DOUBLE_AMPERSAND, TokenType.AMPERSAND],
      '|': ['|', TokenType.DOUBLE_PIPE, TokenType.PIPE],
      '!': ['=', TokenType.EXCLAMATION_EQUALS, TokenType.EXCLAMATION],
      ':': [':', TokenType.DOUBLE_COLON, TokenType.COLON]
    };
    
    const config = doubleCharTokens[this.current];
    if (config) {
      const [nextChar, doubleType, singleType] = config;
      const firstChar = this.current;
      this.advance();
      if (this.current === nextChar) {
        this.advance();
        return this.makeToken(doubleType, firstChar + nextChar, line, column);
      }
      return this.makeToken(singleType, firstChar, line, column);
    }
    return null;
  }

  private skipWhitespaceAndComments(): void {
    while (true) {
      // Skip whitespace
      while (this.current && /\s/.test(this.current)) {
        this.advance();
      }

      // Skip comments (# or //)
      if (this.current === '#' || (this.current === '/' && this.peek1() === '/')) {
        this.skipLineComment();
        continue;
      }

      break;
    }
  }

  private skipLineComment(): void {
    while (this.current && this.current !== '\n') {
      this.advance();
    }
    if (this.current === '\n') {
      this.advance();
    }
  }

  private peek1(): string {
    return this.source[this.pos + 1] || '';
  }

  private readString(line: number, column: number): Token {
    const quote = this.current;
    this.advance(); // Skip opening quote

    let value = '';
    while (this.current && this.current !== quote) {
      if (this.current === '\\') {
        this.advance();
        const escaped: string = this.current; // Type assertion to avoid narrowing
        switch (escaped) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          default:
            value += escaped;
        }
        this.advance();
      } else {
        value += this.current;
        this.advance();
      }
    }

    if (this.current !== quote) {
      throw new Error(`Unterminated string at line ${line}, column ${column}`);
    }

    this.advance(); // Skip closing quote
    return this.makeToken(TokenType.STRING, value, line, column);
  }

  private readNumber(line: number, column: number): Token {
    let value = '';

    if (this.current === '-') {
      value += this.current;
      this.advance();
    }

    while (this.isDigit(this.current)) {
      value += this.current;
      this.advance();
    }

    // Check if this is actually an identifier starting with a number
    if (this.isIdentifierStart(this.current)) {
      // It's an identifier like "2RouteTableCondition"
      while (this.isIdentifierPart(this.current)) {
        value += this.current;
        this.advance();
      }
      return this.makeToken(TokenType.IDENTIFIER, value, line, column);
    }

    if (this.current === '.') {
      value += this.current;
      this.advance();
      while (this.isDigit(this.current)) {
        value += this.current;
        this.advance();
      }
    }

    return this.makeToken(TokenType.NUMBER, value, line, column);
  }

  private readIdentifier(line: number, column: number): Token {
    let value = '';
    while (this.isIdentifierPart(this.current)) {
      value += this.current;
      this.advance();
    }
    return this.makeToken(TokenType.IDENTIFIER, value, line, column);
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentifierStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
  }

  private isIdentifierPart(ch: string): boolean {
    return this.isIdentifierStart(ch) || this.isDigit(ch);
  }

  private makeToken(type: TokenType, value: string, line?: number, column?: number): Token {
    return {
      type,
      value,
      line: line ?? this.line,
      column: column ?? this.column
    };
  }
}
