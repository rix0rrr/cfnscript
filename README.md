# cfnscript

An alternative syntax for CloudFormation templates using traditional programming language constructs. cfnscript provides a 1:1 bidirectional mapping between CloudFormation JSON/YAML and a more readable, JavaScript-inspired syntax.

## Purpose

cfnscript is a teaching tool that demonstrates CloudFormation's JSON/YAML syntax is entirely incidental. It helps learners who find traditional programming language syntax easier to read and reason about.

## Installation

```bash
npm install
npm run build
```

## Usage

### Compile cfnscript to CloudFormation

```bash
# Compile to YAML (default)
node dist/cli/index.js compile template.cfn output.yaml

# Compile to JSON
node dist/cli/index.js compile template.cfn output.json

# Compile to stdout (YAML)
node dist/cli/index.js compile template.cfn

# Compile to stdout (JSON)
node dist/cli/index.js compile template.cfn --json

# Compile from stdin
cat template.cfn | node dist/cli/index.js compile
```

### Decompile CloudFormation to cfnscript

```bash
# Decompile from file
node dist/cli/index.js decompile template.yaml output.cfn

# Decompile to stdout
node dist/cli/index.js decompile template.yaml

# Decompile from stdin
cat template.yaml | node dist/cli/index.js decompile
```

## Syntax Examples

### Basic Resource

```cfnscript
MyBucket = Resource("AWS::S3::Bucket", {
  BucketName: "my-bucket",
  WebsiteConfiguration: {
    IndexDocument: "index.html"
  }
})
```

### Resource with Attributes

```cfnscript
MyBucket = Resource("AWS::S3::Bucket", {
  BucketName: "my-bucket"
}) DependsOn(OtherResource) Condition(IsProd) DeletionPolicy("Retain")
```

### Parameters

```cfnscript
Environment = Parameter({
  Type: "String",
  Default: "dev",
  AllowedValues: ["dev", "prod"]
})
```

### Outputs

```cfnscript
BucketArn = Output({
  Value: MyBucket.Arn,
  Description: "ARN of the S3 bucket",
  Export: { Name: "MyBucketArn" }
})
```

### Intrinsic Functions

```cfnscript
# Implicit Ref (just use the variable name)
Bucket: MyBucket

# Implicit GetAtt (dot notation)
Value: MyBucket.Arn

# Explicit function calls
Value: Join(",", ["a", "b", "c"])
Value: Sub("Hello ${Name}", { Name: MyParam })
Value: If(IsProd, "prod-value", "dev-value")
```

### Complete Template

```cfnscript
AWSTemplateFormatVersion("2010-09-09")
Description("My CloudFormation template")

Environment = Parameter({
  Type: "String",
  Default: "dev"
})

IsProd = Condition(Equals(Environment, "production"))

MyBucket = Resource("AWS::S3::Bucket", {
  BucketName: Join("-", ["my-bucket", Environment])
}) Condition(IsProd)

BucketArn = Output({
  Value: MyBucket.Arn,
  Description: "Bucket ARN"
})
```

## Features

- **Bidirectional Translation**: Convert between cfnscript and CloudFormation JSON/YAML
- **All CloudFormation Sections**: Parameters, Mappings, Conditions, Resources, Outputs, Metadata, Transform
- **All Intrinsic Functions**: Ref, GetAtt, Join, Split, Sub, Select, If, And, Or, Not, Equals, etc.
- **Implicit References**: Variables automatically translate to `Ref`, dot notation to `Fn::GetAtt`
- **Chainable Resource Attributes**: DependsOn, Condition, DeletionPolicy, etc.
- **Comments**: Both `#` and `//` line comments supported
- **Error Reporting**: Syntax errors with line numbers

## Language Reference

### Comments

```cfnscript
# This is a comment
// This is also a comment
```

### Template Sections

- `AWSTemplateFormatVersion("2010-09-09")`
- `Description("Template description")`
- `Transform("AWS::Serverless-2016-10-31")`
- `Metadata({ ... })`

### Declarations

- `name = Parameter({ ... })`
- `name = Resource("Type", { ... })`
- `name = Output({ ... })`
- `name = Mapping({ ... })`
- `name = Condition(expression)`

### Resource Attributes

- `DependsOn(resource)`
- `Condition(condition)`
- `DeletionPolicy("Retain")`
- `UpdateReplacePolicy("Snapshot")`

### Intrinsic Functions

All CloudFormation intrinsic functions are supported as function calls:
- `Ref(name)` or just use the variable name
- `GetAtt(resource, attribute)` or use dot notation: `resource.attribute`
- `Join(delimiter, list)`
- `Split(delimiter, string)`
- `Sub(template, variables)`
- `Select(index, list)`
- `GetAZs(region)`
- `If(condition, trueValue, falseValue)`
- `And(condition1, condition2, ...)`
- `Or(condition1, condition2, ...)`
- `Not(condition)`
- `Equals(value1, value2)`
- `FindInMap(map, key1, key2)`
- `ImportValue(name)`
- `Base64(string)`
- `Cidr(ipBlock, count, cidrBits)`
- `ToJsonString(object)`
- `Length(array)`

## Development

```bash
# Run tests
npm test

# Build
npm run build

# Watch mode for tests
npm run test:watch
```

## Architecture

- **Lexer**: Tokenizes cfnscript source code
- **Parser**: Builds Abstract Syntax Tree (AST) from tokens
- **AST**: Bidirectional transformation between cfnscript and CloudFormation
- **Compiler**: Orchestrates compilation to JSON/YAML
- **Decompiler**: Converts CloudFormation back to cfnscript
- **CLI**: Command-line interface for compile/decompile operations

## Extensibility

### Adding New Intrinsic Functions

Intrinsic functions are automatically supported. No code changes needed.

### Adding New Template Sections

1. Create AST node class extending `ASTNode`
2. Implement `toCloudFormation()` and `toSource()` methods
3. Add handling in Parser and Decompiler

### Adding New Resource Attributes

Resource attributes are handled uniformly. Just use them in your templates.

## License

ISC
