import * as fs from 'fs';
import * as path from 'path';
import * as jsyaml from 'js-yaml';
import { Compiler, Decompiler } from '../compiler/Compiler';

// CloudFormation schema for js-yaml
const CFN_SCHEMA = jsyaml.DEFAULT_SCHEMA.extend([
  new jsyaml.Type('!Ref', { kind: 'scalar', construct: (data) => ({ Ref: data }) }),
  new jsyaml.Type('!GetAtt', { kind: 'scalar', construct: (data) => ({ 'Fn::GetAtt': data.split('.') }) }),
  new jsyaml.Type('!GetAtt', { kind: 'sequence', construct: (data) => ({ 'Fn::GetAtt': data }) }),
  new jsyaml.Type('!Equals', { kind: 'sequence', construct: (data) => ({ 'Fn::Equals': data }) }),
  new jsyaml.Type('!If', { kind: 'sequence', construct: (data) => ({ 'Fn::If': data }) }),
  new jsyaml.Type('!Join', { kind: 'sequence', construct: (data) => ({ 'Fn::Join': data }) }),
  new jsyaml.Type('!Sub', { kind: 'scalar', construct: (data) => ({ 'Fn::Sub': data }) }),
  new jsyaml.Type('!Sub', { kind: 'sequence', construct: (data) => ({ 'Fn::Sub': data }) }),
  new jsyaml.Type('!Select', { kind: 'sequence', construct: (data) => ({ 'Fn::Select': data }) }),
  new jsyaml.Type('!Split', { kind: 'sequence', construct: (data) => ({ 'Fn::Split': data }) }),
  new jsyaml.Type('!And', { kind: 'sequence', construct: (data) => ({ 'Fn::And': data }) }),
  new jsyaml.Type('!Or', { kind: 'sequence', construct: (data) => ({ 'Fn::Or': data }) }),
  new jsyaml.Type('!Not', { kind: 'sequence', construct: (data) => ({ 'Fn::Not': data }) }),
  new jsyaml.Type('!FindInMap', { kind: 'sequence', construct: (data) => ({ 'Fn::FindInMap': data }) }),
  new jsyaml.Type('!Base64', { kind: 'scalar', construct: (data) => ({ 'Fn::Base64': data }) }),
  new jsyaml.Type('!Cidr', { kind: 'sequence', construct: (data) => ({ 'Fn::Cidr': data }) }),
  new jsyaml.Type('!GetAZs', { kind: 'scalar', construct: (data) => ({ 'Fn::GetAZs': data }) }),
  new jsyaml.Type('!GetAZs', { kind: 'sequence', construct: (data) => ({ 'Fn::GetAZs': data.length > 0 ? data[0] : '' }) }),
  new jsyaml.Type('!ImportValue', { kind: 'scalar', construct: (data) => ({ 'Fn::ImportValue': data }) }),
]);

function normalizeTemplate(template: any): any {
  const normalized = JSON.parse(JSON.stringify(template));
  
  // Remove empty sections
  if (normalized.Mappings && Object.keys(normalized.Mappings).length === 0) {
    delete normalized.Mappings;
  }
  if (normalized.Conditions && Object.keys(normalized.Conditions).length === 0) {
    delete normalized.Conditions;
  }
  if (normalized.Parameters && Object.keys(normalized.Parameters).length === 0) {
    delete normalized.Parameters;
  }
  if (normalized.Outputs && Object.keys(normalized.Outputs).length === 0) {
    delete normalized.Outputs;
  }
  if (normalized.Resources && Object.keys(normalized.Resources).length === 0) {
    delete normalized.Resources;
  }
  
  return normalized;
}

describe('Round-trip tests for AWS CloudFormation templates', () => {
  const examplesDir = 'examples/aws-cloudformation-templates';
  
  if (!fs.existsSync(examplesDir)) {
    it.skip('examples directory not found', () => {});
    return;
  }

  // Find all YAML and JSON files
  const findTemplates = (dir: string): string[] => {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findTemplates(fullPath));
      } else if (entry.isFile() && /\.(json|yaml|yml)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    
    return files;
  };

  const templates = findTemplates(examplesDir);
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  templates.forEach((templatePath) => {
    it(`should round-trip ${path.relative(examplesDir, templatePath)}`, () => {
      try {
        // Read and parse original template
        const content = fs.readFileSync(templatePath, 'utf-8');
        
        // Skip templates with unsupported custom tags
        if (content.includes('!Rain::') || content.includes('!ValueOf')) {
          skipCount++;
          return; // Skip these templates
        }
        
        const originalTemplate = jsyaml.load(content, { schema: CFN_SCHEMA });
        
        // Skip if not a valid CloudFormation template
        if (!originalTemplate || typeof originalTemplate !== 'object') {
          skipCount++;
          return;
        }
        
        // Decompile to cfnscript
        const decompiler = new Decompiler();
        const cfnscript = decompiler.decompile(originalTemplate as any);
        
        // Compile back to CloudFormation
        const compiler = new Compiler();
        const recompiledTemplate = compiler.compile(cfnscript);
        
        // Compare
        expect(normalizeTemplate(recompiledTemplate)).toEqual(normalizeTemplate(originalTemplate));
        successCount++;
      } catch (error) {
        failCount++;
        throw error; // Re-throw to see what's failing
      }
    });
  });

  afterAll(() => {
    console.log(`\n=== Round-trip Test Summary ===`);
    console.log(`Total templates: ${templates.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Skipped: ${skipCount}`);
    console.log(`Success rate: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);
  });
});
