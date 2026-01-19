export interface CloudFormationTemplate {
  AWSTemplateFormatVersion?: string;
  Description?: string;
  Metadata?: Record<string, any>;
  Parameters?: Record<string, ParameterDefinition>;
  Mappings?: Record<string, Mapping>;
  Conditions?: Record<string, any>;
  Transform?: string | string[];
  Resources: Record<string, ResourceDefinition>;
  Outputs?: Record<string, OutputDefinition>;
}

export interface ResourceDefinition {
  Type: string;
  Properties?: Record<string, any>;
  DependsOn?: string | string[];
  Condition?: string;
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
  CreationPolicy?: any;
  UpdatePolicy?: any;
  Metadata?: any;
}

export interface ParameterDefinition {
  Type: string;
  Default?: any;
  Description?: string;
  AllowedValues?: any[];
  AllowedPattern?: string;
  ConstraintDescription?: string;
  MinLength?: number;
  MaxLength?: number;
  MinValue?: number;
  MaxValue?: number;
  NoEcho?: boolean;
}

export interface OutputDefinition {
  Value: any;
  Description?: string;
  Export?: { Name: string };
  Condition?: string;
}

export interface Mapping {
  [topLevelKey: string]: {
    [secondLevelKey: string]: any;
  };
}
