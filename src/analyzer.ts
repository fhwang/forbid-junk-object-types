import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { TypeDefinition, TypeUsage, Violation, AnalyzerOptions, AnalysisResult } from './types.js';
import { collectTypeDefinitions, collectTypeUsages, extendsOtherType } from './parser.js';

function getAllTsFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        getAllTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      if (!file.endsWith('.test.ts') && !file.endsWith('.test.tsx') && !file.endsWith('.spec.ts') && !file.endsWith('.spec.tsx') && !file.endsWith('.d.ts')) {
        fileList.push(filePath);
      }
    }
  }

  return fileList;
}

function isSingleUseType(_definition: TypeDefinition, usages: TypeUsage[]): boolean {
  if (usages.length === 0) {
    return false;
  }

  const uniqueFunctions = new Set(
    usages
      .filter(u => u.functionName)
      .map(u => u.functionName)
  );

  return uniqueFunctions.size === 1;
}

function hasLegitimateReason(definition: TypeDefinition): boolean {
  if (definition.isExported) {
    return true;
  }

  if (ts.isInterfaceDeclaration(definition.node) || ts.isTypeAliasDeclaration(definition.node)) {
    if (extendsOtherType(definition.node as ts.InterfaceDeclaration | ts.TypeAliasDeclaration)) {
      return true;
    }
  }

  // Allow React Props pattern (temporary exception)
  if (definition.name.endsWith('Props')) {
    return true;
  }

  return false;
}

function getFilesToAnalyze(options: AnalyzerOptions): string[] {
  const srcDir = path.join(options.targetDir, 'src');

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source directory not found: ${srcDir}`);
  }

  if (options.specificFiles && options.specificFiles.length > 0) {
    return options.specificFiles.map(f => path.resolve(f));
  }
  return getAllTsFiles(srcDir);
}

function getCompilerOptions(): ts.CompilerOptions {
  return {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    strict: false,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
  };
}

function analyzeSourceFiles(
  program: ts.Program,
  filesToAnalyze: string[]
): { typeDefinitions: Map<string, TypeDefinition>; typeUsages: Map<string, TypeUsage[]> } {
  const typeDefinitions = new Map<string, TypeDefinition>();
  const typeUsages = new Map<string, TypeUsage[]>();

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile && filesToAnalyze.includes(sourceFile.fileName)) {
      collectTypeDefinitions(sourceFile, typeDefinitions);
      collectTypeUsages(sourceFile, typeUsages);
    }
  }

  return { typeDefinitions, typeUsages };
}

function findViolations(
  typeDefinitions: Map<string, TypeDefinition>,
  typeUsages: Map<string, TypeUsage[]>
): Violation[] {
  const violations: Violation[] = [];

  for (const definition of typeDefinitions.values()) {
    const usages = typeUsages.get(definition.name) || [];

    if (isSingleUseType(definition, usages) && !hasLegitimateReason(definition)) {
      const functionName = usages.find(u => u.functionName)?.functionName || 'unknown';
      violations.push({
        kind: 'single-use-named',
        typeName: definition.name,
        filePath: definition.filePath,
        line: definition.line,
        column: definition.column,
        usedByFunction: functionName,
      });
    }
  }

  return violations;
}

export async function analyzeCodebase(options: AnalyzerOptions): Promise<AnalysisResult> {
  const filesToAnalyze = getFilesToAnalyze(options);
  const compilerOptions = getCompilerOptions();
  const program = ts.createProgram(filesToAnalyze, compilerOptions);

  const { typeDefinitions, typeUsages } = analyzeSourceFiles(program, filesToAnalyze);
  const violations = findViolations(typeDefinitions, typeUsages);

  return {
    violations,
    totalTypesAnalyzed: typeDefinitions.size,
    filesAnalyzed: filesToAnalyze.length,
  };
}
