import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { InlineTypeViolation, AnalysisResult } from '../src/types.js';
import { collectInlineObjectTypes } from '../src/parser.js';
import { analyzeCodebase } from '../src/analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('InlineTypeViolation type', () => {
  it('has required fields', () => {
    const violation: InlineTypeViolation = {
      filePath: 'test.ts',
      line: 10,
      column: 5,
      context: "parameter 'opts'",
    };
    expect(violation.filePath).toBe('test.ts');
    expect(violation.line).toBe(10);
    expect(violation.column).toBe(5);
    expect(violation.context).toBe("parameter 'opts'");
  });
});

describe('collectInlineObjectTypes', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  function createProgram(filePath: string): ts.Program {
    const program = ts.createProgram([filePath], {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: false,
    });
    // Access type checker to ensure parent pointers are set on AST nodes
    program.getTypeChecker();
    return program;
  }

  it('detects inline type in function parameter', () => {
    const filePath = path.join(fixturesDir, 'src/inline-type-violations.ts');
    const program = createProgram(filePath);
    const sourceFile = program.getSourceFile(filePath)!;

    const violations = collectInlineObjectTypes(sourceFile);

    const paramViolation = violations.find(v => v.context.includes("parameter 'opts'"));
    expect(paramViolation).toBeDefined();
    expect(paramViolation?.line).toBe(5);
  });

  it('detects inline type in return type', () => {
    const filePath = path.join(fixturesDir, 'src/inline-type-violations.ts');
    const program = createProgram(filePath);
    const sourceFile = program.getSourceFile(filePath)!;

    const violations = collectInlineObjectTypes(sourceFile);

    const returnViolation = violations.find(v => v.context === 'return type');
    expect(returnViolation).toBeDefined();
    expect(returnViolation?.line).toBe(10);
  });

  it('detects inline type in variable declaration', () => {
    const filePath = path.join(fixturesDir, 'src/inline-type-violations.ts');
    const program = createProgram(filePath);
    const sourceFile = program.getSourceFile(filePath)!;

    const violations = collectInlineObjectTypes(sourceFile);

    const varViolation = violations.find(v => v.context.includes("variable 'config'"));
    expect(varViolation).toBeDefined();
    expect(varViolation?.line).toBe(15);
  });

  it('detects inline type in type assertion', () => {
    const filePath = path.join(fixturesDir, 'src/inline-type-violations.ts');
    const program = createProgram(filePath);
    const sourceFile = program.getSourceFile(filePath)!;

    const violations = collectInlineObjectTypes(sourceFile);

    const assertViolation = violations.find(v => v.context === 'type assertion');
    expect(assertViolation).toBeDefined();
    expect(assertViolation?.line).toBe(19);
  });

  it('detects inline type in generic argument', () => {
    const filePath = path.join(fixturesDir, 'src/inline-type-violations.ts');
    const program = createProgram(filePath);
    const sourceFile = program.getSourceFile(filePath)!;

    const violations = collectInlineObjectTypes(sourceFile);

    const genericViolation = violations.find(v => v.context === 'generic argument');
    expect(genericViolation).toBeDefined();
    expect(genericViolation?.line).toBe(22);
  });

  it('detects inline type in destructured parameter', () => {
    const filePath = path.join(fixturesDir, 'src/inline-type-violations.ts');
    const program = createProgram(filePath);
    const sourceFile = program.getSourceFile(filePath)!;

    const violations = collectInlineObjectTypes(sourceFile);

    const destructureViolation = violations.find(v => v.context === 'destructured parameter');
    expect(destructureViolation).toBeDefined();
    expect(destructureViolation?.line).toBe(25);
  });

  it('detects inline type in interface property', () => {
    const filePath = path.join(fixturesDir, 'src/inline-type-violations.ts');
    const program = createProgram(filePath);
    const sourceFile = program.getSourceFile(filePath)!;

    const violations = collectInlineObjectTypes(sourceFile);

    const propViolation = violations.find(v => v.context.includes("property 'nested'"));
    expect(propViolation).toBeDefined();
    expect(propViolation?.line).toBe(31);
  });

  it('does NOT flag generic constraints', () => {
    const filePath = path.join(fixturesDir, 'src/inline-types-valid.ts');
    const program = createProgram(filePath);
    const sourceFile = program.getSourceFile(filePath)!;

    const violations = collectInlineObjectTypes(sourceFile);

    // Should have no violations - only generic constraints and named types
    expect(violations.length).toBe(0);
  });
});

describe('AnalysisResult with inline violations', () => {
  it('includes inlineViolations field', () => {
    const result: AnalysisResult = {
      violations: [],
      inlineViolations: [],
      totalTypesAnalyzed: 0,
      filesAnalyzed: 0,
    };
    expect(result.inlineViolations).toEqual([]);
  });
});

describe('analyzeCodebase with inline types', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  it('returns inline violations from analyzeCodebase', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/inline-type-violations.ts')],
    });

    expect(result.inlineViolations.length).toBeGreaterThan(0);

    const contexts = result.inlineViolations.map(v => v.context);
    expect(contexts).toContain("parameter 'opts'");
    expect(contexts).toContain('return type');
    expect(contexts).toContain("variable 'config'");
    expect(contexts).toContain('type assertion');
    expect(contexts).toContain('generic argument');
    expect(contexts).toContain('destructured parameter');
  });

  it('does not return inline violations for generic constraints', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/inline-types-valid.ts')],
    });

    expect(result.inlineViolations.length).toBe(0);
  });
});
