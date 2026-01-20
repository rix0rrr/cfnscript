import { Compiler } from './Compiler';

describe('Condition reference', () => {
  it('should compile condition references to { Condition: name }', () => {
    const cfnscript = `
IsProd = Condition(Equals(Env, 'prod'))
IsStaging = Condition(Equals(Env, 'staging'))
IsProdOrStaging = Condition(Or(IsProd, IsStaging))
`;

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Conditions).toEqual({
      IsProd: { 'Fn::Equals': [{ Ref: 'Env' }, 'prod'] },
      IsStaging: { 'Fn::Equals': [{ Ref: 'Env' }, 'staging'] },
      IsProdOrStaging: {
        'Fn::Or': [
          { Condition: 'IsProd' },
          { Condition: 'IsStaging' }
        ]
      }
    });
  });

  it('should handle quoted condition names', () => {
    const cfnscript = `
'3RouteTableCondition' = Condition(Equals(Env, 'prod'))
'4RouteTableCondition' = Condition(Equals(Env, 'staging'))
'2RouteTableCondition' = Condition(Or('3RouteTableCondition', '4RouteTableCondition'))
`;

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Conditions).toEqual({
      '3RouteTableCondition': { 'Fn::Equals': [{ Ref: 'Env' }, 'prod'] },
      '4RouteTableCondition': { 'Fn::Equals': [{ Ref: 'Env' }, 'staging'] },
      '2RouteTableCondition': {
        'Fn::Or': [
          '3RouteTableCondition',
          '4RouteTableCondition'
        ]
      }
    });
  });
});
