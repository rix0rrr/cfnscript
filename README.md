# cfnscript

An alternative syntax for CloudFormation templates using traditional programming language constructs.

## Purpose

cfnscript is a teaching tool to highlight the programming language that's hidden underneath
the JSON-encoded structure of a CloudFormation template.

It provides a 1:1 bidirectional mapping between CloudFormation template syntax and a more readable, JavaScript-inspired
syntax.

## Usage

```bash
# Compile cfnscript YAML on stdout
$ npx tsx src/cli/index.ts compile template.cfn

# Decompile a template to cfnscript on stdout
$ npx tsx src/cli/index.ts decompile template.yaml
```

## Syntax Examples

### Basic Resource

```js
MyBucket = Resource AWS::S3::Bucket {
  BucketName: "my-bucket",
  WebsiteConfiguration: {
    IndexDocument: "index.html"
  }
}
```

### Resource with Attributes

```js
MyBucket = Resource AWS::S3::Bucket {
  BucketName: "my-bucket"
} DependsOn(OtherResource) Condition(IsProd) DeletionPolicy("Retain")
```

### Parameters

```js
Environment = Parameter {
  Type: "String",
  Default: "dev",
  AllowedValues: ["dev", "prod"]
}
```

### Outputs

```js
BucketArn = Output {
  Value: MyBucket.Arn,
  Description: "ARN of the S3 bucket",
  Export: { Name: "MyBucketArn" }
}
```

### Intrinsic Functions

```js
# Implicit Ref (just use the variable name)
Bucket: MyBucket

# Implicit GetAtt (dot notation)
Value: MyBucket.Arn

# Operators for conditions
IsProd = Condition Environment == "production"
IsNotProd = Condition Environment != "production"
IsDevOrTest = Condition Environment == "dev" || Environment == "test"
IsUSProd = Condition Region == "us-east-1" && Environment == "production"

# Explicit function calls
Value: Join(",", ["a", "b", "c"])
Value: Sub("Hello ${Name}", { Name: MyParam })
Value: If(IsProd, "prod-value", "dev-value")
```

### Complete Template

```js
AWSTemplateFormatVersion "2010-09-09"
Description "My CloudFormation template"

Environment = Parameter {
  Type: "String",
  Default: "dev"
}

IsProd = Condition Environment == "production"

MyBucket = Resource AWS::S3::Bucket {
  BucketName: Join("-", ["my-bucket", Environment])
} Condition(IsProd)

BucketArn = Output {
  Value: MyBucket.Arn,
  Description: "Bucket ARN"
}
```

## Language Reference

### Comments

```
# This is a comment
// This is also a comment
```

### Template Sections

- `AWSTemplateFormatVersion "2010-09-09"`
- `Description "Template description"`
- `Transform "AWS::Serverless-2016-10-31"`
- `Metadata { ... }`
- `Globals { ... }`

### Declarations

- `name = Parameter { ... }`
- `name = Resource Type { ... }`
- `name = Output { ... }`
- `name = Mapping { ... }`
- `name = Condition expression`

### Resource Attributes

- `DependsOn(resource)`
- `Condition(condition)`
- `DeletionPolicy("Retain")`
- `UpdateReplacePolicy("Snapshot")`

### Intrinsic Functions

All CloudFormation intrinsic functions are supported:
- `Ref(name)` or just use the variable name
- `GetAtt(resource, attribute)` or use dot notation: `resource.attribute`
- `Join(delimiter, list)`
- `Split(delimiter, string)`
- `Sub(template, variables)`
- `Select(index, list)`
- `GetAZs(region)`
- `If(condition, trueValue, falseValue)`
- `FindInMap(map, key1, key2)`
- `ImportValue(name)`
- `Base64(string)`
- `Cidr(ipBlock, count, cidrBits)`
- `ToJsonString(object)`
- `Length(array)`

### Condition Operators

For conditions, use operators instead of function calls:
- `!condition` compiles to `Fn::Not`
- `value1 == value2` compiles to `Fn::Equals`
- `value1 != value2` compiles to `Fn::Not` with `Fn::Equals` (syntactic sugar for `!(value1 == value2)`)
- `condition1 && condition2` compiles to `Fn::And`
- `condition1 || condition2` compiles to `Fn::Or`

## License

ISC
