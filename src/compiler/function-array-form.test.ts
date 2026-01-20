import { Compiler } from '../compiler/Compiler';

describe('Functions that always require array form', () => {
  it('should use array form for Not even with single argument', () => {
    const cfnscript = `
MyCondition = Condition Not(Equals(MyParam, 'value'))
    `.trim();

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Conditions?.MyCondition).toEqual({
      'Fn::Not': [{
        'Fn::Equals': [{ Ref: 'MyParam' }, 'value']
      }]
    });
  });

  it('should use array form for And', () => {
    const cfnscript = `
MyCondition = Condition And(Cond1, Cond2)
    `.trim();

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Conditions?.MyCondition).toEqual({
      'Fn::And': [{ Ref: 'Cond1' }, { Ref: 'Cond2' }]
    });
  });

  it('should use array form for Or', () => {
    const cfnscript = `
MyCondition = Condition Or(Cond1, Cond2)
    `.trim();

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Conditions?.MyCondition).toEqual({
      'Fn::Or': [{ Ref: 'Cond1' }, { Ref: 'Cond2' }]
    });
  });

  it('should use array form for Equals', () => {
    const cfnscript = `
MyCondition = Condition Equals(MyParam, 'value')
    `.trim();

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Conditions?.MyCondition).toEqual({
      'Fn::Equals': [{ Ref: 'MyParam' }, 'value']
    });
  });

  it('should use scalar form for Base64 with single argument', () => {
    const cfnscript = `
MyResource = Resource AWS::Test { UserData: Base64('hello') }
    `.trim();

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Resources.MyResource.Properties?.UserData).toEqual({
      'Fn::Base64': 'hello'
    });
  });

  it('should use scalar form for ImportValue with single argument', () => {
    const cfnscript = `
MyResource = Resource AWS::Test { Value: ImportValue('ExportName') }
    `.trim();

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Resources.MyResource.Properties?.Value).toEqual({
      'Fn::ImportValue': 'ExportName'
    });
  });
});
