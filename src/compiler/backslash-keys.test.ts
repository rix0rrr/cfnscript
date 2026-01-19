import { Compiler, Decompiler } from '../compiler/Compiler';

describe('Backslashes in object keys', () => {
  it('should preserve backslashes in object keys', () => {
    const original = {
      Resources: {
        Test: {
          Type: 'AWS::Test',
          Properties: {
            Files: {
              'c:\\cfn\\test.conf': {
                Content: 'test'
              }
            }
          }
        }
      }
    };

    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(original);

    expect(cfnscript).toContain("'c:\\\\cfn\\\\test.conf'");

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    expect(Object.keys(recompiled.Resources.Test.Properties?.Files || {})[0]).toBe('c:\\cfn\\test.conf');
  });
});
