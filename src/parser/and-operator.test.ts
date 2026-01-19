import { Compiler } from '../compiler/Compiler';

describe('And operator', () => {
  it('should compile && operator to Fn::And', () => {
    const source = `
IsValid = Condition(IsProd && IsEnabled)
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
IsValid = Condition(Cond1 && Cond2 && Cond3)
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
IsValid = Condition(Env == "prod" && Region == "us-east-1")
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
});
