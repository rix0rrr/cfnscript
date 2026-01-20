import { Compiler } from '../compiler/Compiler';

describe('Equals operator', () => {
  it('should compile == operator to Fn::Equals', () => {
    const source = `
IsProd = Condition Environment == "production"
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions).toBeDefined();
    expect(result.Conditions!.IsProd).toEqual({
      'Fn::Equals': [
        { Ref: 'Environment' },
        'production'
      ]
    });
  });

  it('should handle == with two identifiers', () => {
    const source = `
IsEqual = Condition Param1 == Param2
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions!.IsEqual).toEqual({
      'Fn::Equals': [
        { Ref: 'Param1' },
        { Ref: 'Param2' }
      ]
    });
  });

  it('should handle == with member access', () => {
    const source = `
IsEqual = Condition MyResource.Arn == "test"
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions!.IsEqual).toEqual({
      'Fn::Equals': [
        { 'Fn::GetAtt': ['MyResource', 'Arn'] },
        'test'
      ]
    });
  });
});
