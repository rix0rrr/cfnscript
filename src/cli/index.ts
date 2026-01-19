#!/usr/bin/env node

import * as fs from 'fs';
import * as jsyaml from 'js-yaml';
import { Compiler, Decompiler } from '../compiler/Compiler';

// CloudFormation schema for js-yaml
const CFN_SCHEMA = jsyaml.JSON_SCHEMA.extend([
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
  new jsyaml.Type('!ImportValue', { kind: 'scalar', construct: (data) => ({ 'Fn::ImportValue': data }) }),
]);

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: cfnscript <compile|decompile> [input] [output] [--json]');
    process.exit(1);
  }
  
  const command = args[0];
  const inputPath = args[1];
  const outputPath = args[2];
  const forceJSON = args.includes('--json');
  
  try {
    if (command === 'compile') {
      await compile(inputPath, outputPath, forceJSON);
    } else if (command === 'decompile') {
      await decompile(inputPath, outputPath);
    } else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

async function compile(inputPath?: string, outputPath?: string, forceJSON: boolean = false) {
  // Read input
  const input = inputPath 
    ? fs.readFileSync(inputPath, 'utf-8')
    : await readStdin();
  
  const compiler = new Compiler();
  
  // Determine output format
  let output: string;
  if (outputPath) {
    const ext = outputPath.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
      output = compiler.compileToJSON(input);
    } else {
      output = compiler.compileToYAML(input);
    }
  } else {
    // stdout
    output = forceJSON ? compiler.compileToJSON(input) : compiler.compileToYAML(input);
  }
  
  // Write output
  if (outputPath) {
    fs.writeFileSync(outputPath, output);
  } else {
    console.log(output);
  }
}

async function decompile(inputPath?: string, outputPath?: string) {
  // Read input
  const input = inputPath 
    ? fs.readFileSync(inputPath, 'utf-8')
    : await readStdin();
  
  const template = jsyaml.load(input, { schema: CFN_SCHEMA });
  const decompiler = new Decompiler();
  const output = decompiler.decompile(template as any);
  
  // Write output
  if (outputPath) {
    fs.writeFileSync(outputPath, output);
  } else {
    console.log(output);
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

main();
