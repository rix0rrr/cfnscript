import { Compiler } from '../compiler/Compiler';

describe('Chained member access', () => {
  it('should compile chained member access to GetAtt with dotted attribute', () => {
    const cfnscript = `
MyOutput = Output { Value: MyResource.Compliance.Type }
    `.trim();

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Outputs?.MyOutput).toEqual({
      Value: {
        'Fn::GetAtt': ['MyResource', 'Compliance.Type']
      }
    });
  });

  it('should handle triple-chained member access', () => {
    const cfnscript = `
MyOutput = Output { Value: MyResource.A.B.C }
    `.trim();

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Outputs?.MyOutput).toEqual({
      Value: {
        'Fn::GetAtt': ['MyResource', 'A.B.C']
      }
    });
  });
});
