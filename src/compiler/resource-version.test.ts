import { Compiler, Decompiler } from '../compiler/Compiler';

describe('Resource Version attribute', () => {
  it('should preserve Version attribute', () => {
    const original = {
      Resources: {
        MyResource: {
          Type: 'Custom::MyResource',
          Properties: {
            Param: 'value'
          },
          Version: '1.0'
        }
      }
    };

    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(original);

    expect(cfnscript).toContain("Version('1.0')");

    const compiler = new Compiler();
    const recompiled = compiler.compile(cfnscript);

    expect(recompiled.Resources.MyResource).toEqual({
      Type: 'Custom::MyResource',
      Properties: {
        Param: 'value'
      },
      Version: '1.0'
    });
  });
});
