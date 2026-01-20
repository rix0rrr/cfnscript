import { Compiler } from './Compiler';

describe('Condition reference', () => {
  it('should compile condition references to { Condition: name }', () => {
    const cfnscript = `
IsProd = Condition Env == 'prod'
IsStaging = Condition Env == 'staging'
IsProdOrStaging = Condition IsProd || IsStaging
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
'3RouteTableCondition' = Condition Env == 'prod'
'4RouteTableCondition' = Condition Env == 'staging'
'2RouteTableCondition' = Condition '3RouteTableCondition' || '4RouteTableCondition'
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
