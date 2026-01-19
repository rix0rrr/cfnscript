import * as fs from 'fs';
import * as jsyaml from 'js-yaml';
import { Compiler, Decompiler } from '../compiler/Compiler';

// CloudFormation schema for js-yaml
const CFN_SCHEMA = jsyaml.JSON_SCHEMA.extend([
  new jsyaml.Type('!Ref', {
    kind: 'scalar',
    construct: (data) => ({ Ref: data })
  }),
  new jsyaml.Type('!GetAtt', {
    kind: 'scalar',
    construct: (data) => {
      const parts = data.split('.');
      return { 'Fn::GetAtt': parts };
    }
  }),
  new jsyaml.Type('!GetAtt', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::GetAtt': data })
  }),
  new jsyaml.Type('!Equals', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::Equals': data })
  }),
  new jsyaml.Type('!If', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::If': data })
  }),
  new jsyaml.Type('!Join', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::Join': data })
  }),
  new jsyaml.Type('!Sub', {
    kind: 'scalar',
    construct: (data) => ({ 'Fn::Sub': data })
  }),
  new jsyaml.Type('!Sub', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::Sub': data })
  }),
  new jsyaml.Type('!Select', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::Select': data })
  }),
  new jsyaml.Type('!Split', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::Split': data })
  }),
  new jsyaml.Type('!And', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::And': data })
  }),
  new jsyaml.Type('!Or', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::Or': data })
  }),
  new jsyaml.Type('!Not', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::Not': data })
  }),
  new jsyaml.Type('!FindInMap', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::FindInMap': data })
  }),
  new jsyaml.Type('!Base64', {
    kind: 'scalar',
    construct: (data) => ({ 'Fn::Base64': data })
  }),
  new jsyaml.Type('!Cidr', {
    kind: 'sequence',
    construct: (data) => ({ 'Fn::Cidr': data })
  }),
  new jsyaml.Type('!GetAZs', {
    kind: 'scalar',
    construct: (data) => ({ 'Fn::GetAZs': data })
  }),
  new jsyaml.Type('!ImportValue', {
    kind: 'scalar',
    construct: (data) => ({ 'Fn::ImportValue': data })
  }),
]);

describe('Round-trip test', () => {
  it('should round-trip example.yaml', () => {
    // Read original YAML
    const originalYaml = fs.readFileSync('example.yaml', 'utf-8');
    
    // Parse with CloudFormation schema
    const originalTemplate = jsyaml.load(originalYaml, { schema: CFN_SCHEMA });
    
    // Decompile to cfnscript
    const decompiler = new Decompiler();
    const cfnscript = decompiler.decompile(originalTemplate as any);
    
    // Compile back to CloudFormation
    const compiler = new Compiler();
    const recompiledTemplate = compiler.compile(cfnscript);
    
    // Compare (ignoring key order and empty sections)
    expect(normalizeTemplate(recompiledTemplate)).toEqual(normalizeTemplate(originalTemplate));
  });
});

function normalizeTemplate(template: any): any {
  const normalized = JSON.parse(JSON.stringify(template));
  
  // Remove empty Mappings
  if (normalized.Mappings && Object.keys(normalized.Mappings).length === 0) {
    delete normalized.Mappings;
  }
  
  // Remove empty Conditions
  if (normalized.Conditions && Object.keys(normalized.Conditions).length === 0) {
    delete normalized.Conditions;
  }
  
  // Remove empty Parameters
  if (normalized.Parameters && Object.keys(normalized.Parameters).length === 0) {
    delete normalized.Parameters;
  }
  
  // Remove empty Outputs
  if (normalized.Outputs && Object.keys(normalized.Outputs).length === 0) {
    delete normalized.Outputs;
  }
  
  // Remove empty Resources (though this should never happen)
  if (normalized.Resources && Object.keys(normalized.Resources).length === 0) {
    delete normalized.Resources;
  }
  
  return normalized;
}
