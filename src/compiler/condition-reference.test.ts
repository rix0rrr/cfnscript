import { Compiler } from './Compiler';

describe('Condition reference', () => {
  it('should compile Condition() function to { Condition: name }', () => {
    const cfnscript = `
IsProd = Condition(Equals(Env, 'prod'))
IsStaging = Condition(Equals(Env, 'staging'))
IsProdOrStaging = Condition(Or(Condition(IsProd), Condition(IsStaging)))
`;

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Conditions).toEqual({
      IsProd: { 'Fn::Equals': ['Env', 'prod'] },
      IsStaging: { 'Fn::Equals': ['Env', 'staging'] },
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
'2RouteTableCondition' = Condition(Or(Condition('3RouteTableCondition'), Condition('4RouteTableCondition')))
`;

    const compiler = new Compiler();
    const result = compiler.compile(cfnscript);

    expect(result.Conditions).toEqual({
      '2RouteTableCondition': {
        'Fn::Or': [
          { Condition: '3RouteTableCondition' },
          { Condition: '4RouteTableCondition' }
        ]
      }
    });
  });
});
