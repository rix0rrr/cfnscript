export enum TokenType {
  IDENTIFIER,
  STRING,
  NUMBER,
  EQUALS,
  LPAREN,
  RPAREN,
  LBRACE,
  RBRACE,
  LBRACKET,
  RBRACKET,
  COMMA,
  DOT,
  COLON,
  COMMENT,
  EOF
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}
