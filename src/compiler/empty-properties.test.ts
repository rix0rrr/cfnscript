import { Compiler, Decompiler } from '../compiler/Compiler';

describe('Resource with empty or missing Properties', () => {
  it('should not preserve empty Properties object (cannot distinguish from missing)', () => {
    const original = {
      Resources: {
        MyTopic: {
          Type: 'AWS::SNS::Topic',
          Properties: {}
        }
      }
    };

    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(original);

    expect(cfnscript).toContain('MyTopic = Resource(\'AWS::SNS::Topic\', {})');

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    // Empty Properties is not preserved (same as missing Properties)
    expect(recompiled.Resources.MyTopic).toEqual({
      Type: 'AWS::SNS::Topic'
    });
  });

  it('should handle missing Properties', () => {
    const original = {
      Resources: {
        MyTopic: {
          Type: 'AWS::SNS::Topic'
        }
      }
    };

    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(original);

    expect(cfnscript).toContain('MyTopic = Resource(\'AWS::SNS::Topic\', {})');

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    // When Properties is missing, we output empty object which should not add Properties
    expect(recompiled.Resources.MyTopic).toEqual({
      Type: 'AWS::SNS::Topic'
    });
  });

  it('should preserve non-empty Properties', () => {
    const original = {
      Resources: {
        MyTopic: {
          Type: 'AWS::SNS::Topic',
          Properties: {
            TopicName: 'MyTopic'
          }
        }
      }
    };

    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(original);

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    expect(recompiled.Resources.MyTopic).toEqual({
      Type: 'AWS::SNS::Topic',
      Properties: {
        TopicName: 'MyTopic'
      }
    });
  });
});
