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

    // Single character tokens
    switch (this.current) {
      case '=': return this.advance(), this.makeToken(TokenType.EQUALS, '=', line, column);
      case '(': return this.advance(), this.makeToken(TokenType.LPAREN, '(', line, column);
      case ')': return this.advance(), this.makeToken(TokenType.RPAREN, ')', line, column);
      case '{': return this.advance(), this.makeToken(TokenType.LBRACE, '{', line, column);
      case '}': return this.advance(), this.makeToken(TokenType.RBRACE, '}', line, column);
      case '[': return this.advance(), this.makeToken(TokenType.LBRACKET, '[', line, column);
      case ']': return this.advance(), this.makeToken(TokenType.RBRACKET, ']', line, column);
      case ',': return this.advance(), this.makeToken(TokenType.COMMA, ',', line, column);
      case '.': return this.advance(), this.makeToken(TokenType.DOT, '.', line, column);
      case ':': return this.advance(), this.makeToken(TokenType.COLON, ':', line, column);
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

  private skipWhitespaceAndComments(): void {
    while (true) {
      // Skip whitespace
      while (this.current && /\s/.test(this.current)) {
        this.advance();
      }

      // Skip # comments
      if (this.current === '#') {
        let ch: string = this.current;
        while (ch && ch !== '\n') {
          this.advance();
          ch = this.current;
        }
        if (ch === '\n') {
          this.advance();
        }
        continue;
      }

      // Skip // comments
      if (this.current === '/' && this.peek1() === '/') {
        let ch: string = this.current;
        while (ch && ch !== '\n') {
          this.advance();
          ch = this.current;
        }
        if (ch === '\n') {
          this.advance();
        }
        continue;
      }

      break;
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
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
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
