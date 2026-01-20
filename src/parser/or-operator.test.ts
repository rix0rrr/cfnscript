import { Compiler } from '../compiler/Compiler';

describe('Or operator', () => {
  it('should compile || operator to Fn::Or', () => {
    const source = `
IsDev = Parameter { Type: "String" }
IsTest = Parameter { Type: "String" }
IsValid = Condition IsDev || IsTest
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions).toBeDefined();
    expect(result.Conditions!.IsValid).toEqual({
      'Fn::Or': [
        { Ref: 'IsDev' },
        { Ref: 'IsTest' }
      ]
    });
  });

  it('should handle || with multiple conditions', () => {
    const source = `
IsDev = Parameter { Type: "String" }
IsTest = Parameter { Type: "String" }
IsProd = Parameter { Type: "String" }
IsAnyEnv = Condition IsDev || IsTest || IsProd
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions!.IsAnyEnv).toEqual({
      'Fn::Or': [
        { Ref: 'IsDev' },
        { Ref: 'IsTest' },
        { Ref: 'IsProd' }
      ]
    });
  });

  it('should handle mixed && and || with correct precedence', () => {
    const source = `
IsDev = Parameter { Type: "String" }
IsUS = Parameter { Type: "String" }
IsProd = Parameter { Type: "String" }
IsEU = Parameter { Type: "String" }
Complex = Condition IsDev && IsUS || IsProd && IsEU
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    // && has higher precedence than ||
    // So this should be: (IsDev && IsUS) || (IsProd && IsEU)
    expect(result.Conditions!.Complex).toEqual({
      'Fn::Or': [
        {
          'Fn::And': [
            { Ref: 'IsDev' },
            { Ref: 'IsUS' }
          ]
        },
        {
          'Fn::And': [
            { Ref: 'IsProd' },
            { Ref: 'IsEU' }
          ]
        }
      ]
    });
  });

  it('should handle parentheses for grouping', () => {
    const source = `
A = Parameter { Type: "String" }
B = Parameter { Type: "String" }
C = Parameter { Type: "String" }
D = Parameter { Type: "String" }
IsValid = Condition A || B || (C || D)
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions!.IsValid).toEqual({
      'Fn::Or': [
        { Ref: 'A' },
        { Ref: 'B' },
        {
          'Fn::Or': [
            { Ref: 'C' },
            { Ref: 'D' }
          ]
        }
      ]
    });
  });
});
