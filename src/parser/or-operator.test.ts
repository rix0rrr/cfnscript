import { Compiler } from '../compiler/Compiler';

describe('Or operator', () => {
  it('should compile || operator to Fn::Or', () => {
    const source = `
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
});
