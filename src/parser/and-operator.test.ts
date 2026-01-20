import { Compiler } from '../compiler/Compiler';

describe('And operator', () => {
  it('should compile && operator to Fn::And', () => {
    const source = `
IsProd = Parameter { Type: 'String' }
IsEnabled = Parameter { Type: 'String' }
IsValid = Condition IsProd && IsEnabled
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions).toBeDefined();
    expect(result.Conditions!.IsValid).toEqual({
      'Fn::And': [
        { Ref: 'IsProd' },
        { Ref: 'IsEnabled' }
      ]
    });
  });

  it('should handle && with multiple conditions', () => {
    const source = `
Cond1 = Parameter { Type: "String" }
Cond2 = Parameter { Type: "String" }
Cond3 = Parameter { Type: "String" }
IsValid = Condition Cond1 && Cond2 && Cond3
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions!.IsValid).toEqual({
      'Fn::And': [
        { Ref: 'Cond1' },
        { Ref: 'Cond2' },
        { Ref: 'Cond3' }
      ]
    });
  });

  it('should handle && with Equals expressions', () => {
    const source = `
Env = Parameter { Type: "String" }
Region = Parameter { Type: "String" }
IsValid = Condition Env == "prod" && Region == "us-east-1"
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions!.IsValid).toEqual({
      'Fn::And': [
        {
          'Fn::Equals': [
            { Ref: 'Env' },
            'prod'
          ]
        },
        {
          'Fn::Equals': [
            { Ref: 'Region' },
            'us-east-1'
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
IsValid = Condition A && B && (C && D)
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions!.IsValid).toEqual({
      'Fn::And': [
        { Ref: 'A' },
        { Ref: 'B' },
        {
          'Fn::And': [
            { Ref: 'C' },
            { Ref: 'D' }
          ]
        }
      ]
    });
  });
});
