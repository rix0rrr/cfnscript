import { Compiler, Decompiler } from '../compiler/Compiler';

describe('Resource with empty or missing Properties', () => {
  it('should preserve empty Properties object', () => {
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

    expect(cfnscript).toContain('MyTopic = Resource AWS::SNS::Topic {}');

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    // Empty Properties should be preserved
    expect(recompiled.Resources.MyTopic).toEqual({
      Type: 'AWS::SNS::Topic',
      Properties: {}
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

    // Missing Properties should decompile without second argument
    expect(cfnscript).toContain('MyTopic = Resource AWS::SNS::Topic');

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    // Missing Properties should not add Properties
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
