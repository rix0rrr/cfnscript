import { Compiler, Decompiler } from '../compiler/Compiler';

describe('GetAtt with multiple array elements', () => {
  it('should use dot notation for 2-element GetAtt', () => {
    const original = {
      Resources: {
        MyResource: {
          Type: 'AWS::Test',
          Properties: {
            Value: {
              'Fn::GetAtt': ['OtherResource', 'Arn']
            }
          }
        }
      }
    };

    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(original);

    expect(cfnscript).toContain('OtherResource.Arn');

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    expect(recompiled.Resources.MyResource.Properties?.Value).toEqual({
      'Fn::GetAtt': ['OtherResource', 'Arn']
    });
  });

  it('should convert 3+ element array to bracket notation', () => {
    const original = {
      Resources: {
        MyResource: {
          Type: 'AWS::Test',
          Properties: {
            Value: {
              'Fn::GetAtt': ['OtherResource', 'Compliance', 'Type']
            }
          }
        }
      }
    };

    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(original);

    expect(cfnscript).toContain('OtherResource["Compliance", "Type"]');

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    // Preserves 3-element form
    expect(recompiled.Resources.MyResource.Properties?.Value).toEqual({
      'Fn::GetAtt': ['OtherResource', 'Compliance', 'Type']
    });
  });

  it('should handle dotted attribute name (2-element form)', () => {
    const original = {
      Resources: {
        MyResource: {
          Type: 'AWS::Test',
          Properties: {
            Value: {
              'Fn::GetAtt': ['OtherResource', 'Compliance.Type']
            }
          }
        }
      }
    };

    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(original);

    expect(cfnscript).toContain('OtherResource.Compliance.Type');

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    expect(recompiled.Resources.MyResource.Properties?.Value).toEqual({
      'Fn::GetAtt': ['OtherResource', 'Compliance.Type']
    });
  });
});
