import { Compiler } from '../compiler/Compiler';

describe('Equals operator', () => {
  it('should compile == operator to Fn::Equals', () => {
    const source = `
Environment = Parameter { Type: "String" }
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
Param1 = Parameter { Type: "String" }
Param2 = Parameter { Type: "String" }
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
MyResource = Resource AWS::S3::Bucket {}
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

  it('should compile != operator to Not(Equals)', () => {
    const source = `
Environment = Parameter { Type: "String" }
IsNotProd = Condition Environment != "production"
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Conditions!.IsNotProd).toEqual({
      'Fn::Not': [{
        'Fn::Equals': [
          { Ref: 'Environment' },
          'production'
        ]
      }]
    });
  });

  it('should decompile Not(Equals) as != operator', () => {
    const template = {
      Conditions: {
        IsNotProd: {
          'Fn::Not': [{
            'Fn::Equals': [
              { Ref: 'Environment' },
              'production'
            ]
          }]
        }
      }
    };
    
    const { Decompiler } = require('../compiler/Compiler');
    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(template);
    
    expect(cfnscript).toContain('Environment != \'production\'');
  });
});
