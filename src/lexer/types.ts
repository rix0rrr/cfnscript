export enum TokenType {
  IDENTIFIER,
  STRING,
  NUMBER,
  EQUALS,
  DOUBLE_EQUALS,
  AMPERSAND,
  DOUBLE_AMPERSAND,
  PIPE,
  DOUBLE_PIPE,
  EXCLAMATION,
  LPAREN,
  RPAREN,
  LBRACE,
  RBRACE,
  LBRACKET,
  RBRACKET,
  COMMA,
  DOT,
  COLON,
  DOUBLE_COLON,
  COMMENT,
  EOF
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}
