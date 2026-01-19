import { Compiler } from '../compiler/Compiler';

describe('Or operator', () => {
  it('should compile || operator to Fn::Or', () => {
    const source = `
IsValid = Condition(IsDev || IsTest)
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
IsValid = Condition(Cond1 || Cond2 || Cond3)
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions!.IsValid).toEqual({
      'Fn::Or': [
        { Ref: 'Cond1' },
        { Ref: 'Cond2' },
        { Ref: 'Cond3' }
      ]
    });
  });

  it('should handle mixed && and || with correct precedence', () => {
    const source = `
IsValid = Condition(Cond1 && Cond2 || Cond3 && Cond4)
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    // || has lower precedence than &&, so this should be:
    // Or(And(Cond1, Cond2), And(Cond3, Cond4))
    expect(result.Conditions!.IsValid).toEqual({
      'Fn::Or': [
        {
          'Fn::And': [
            { Ref: 'Cond1' },
            { Ref: 'Cond2' }
          ]
        },
        {
          'Fn::And': [
            { Ref: 'Cond3' },
            { Ref: 'Cond4' }
          ]
        }
      ]
    });
  });
});
