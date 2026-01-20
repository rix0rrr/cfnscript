import { Compiler } from '../compiler/Compiler';

describe('AWS pseudo-parameters', () => {
  it('should compile AWS.Region to Ref AWS::Region', () => {
    const source = `
MyOutput = Output {
  Value: AWS.Region
}
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Outputs).toBeDefined();
    expect(result.Outputs!.MyOutput).toEqual({
      Value: { Ref: 'AWS::Region' }
    });
  });

  it('should compile AWS.AccountId', () => {
    const source = `
MyOutput = Output {
  Value: AWS.AccountId
}
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Outputs!.MyOutput.Value).toEqual({
      Ref: 'AWS::AccountId'
    });
  });

  it('should compile AWS.NoValue', () => {
    const source = `
HasName = Condition true
BucketName = Parameter { Type: "String" }

MyResource = Resource AWS::S3::Bucket {
  BucketName: If(HasName, BucketName, AWS.NoValue)
}
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Resources!.MyResource.Properties!.BucketName).toEqual({
      'Fn::If': [
        'HasName',
        { Ref: 'BucketName' },
        { Ref: 'AWS::NoValue' }
      ]
    });
  });

  it('should compile AWS.StackName', () => {
    const source = `
MyTag = Parameter {
  Type: 'String',
  Default: AWS.StackName
}
    `.trim();
    
    const compiler = new Compiler();
    const result = compiler.compile(source);
    
    expect(result.Parameters!.MyTag.Default).toEqual({
      Ref: 'AWS::StackName'
    });
  });
});
