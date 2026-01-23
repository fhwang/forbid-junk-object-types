import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import * as path from 'path';
import { collectInlineObjectViolations } from '../src/inline-detector.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('collectInlineObjectViolations', () => {
  function analyzeFile(filename: string) {
    const filePath = path.join(__dirname, 'fixtures/src', filename);
    const program = ts.createProgram([filePath], {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    });
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`Could not load ${filePath}`);
    }
    return collectInlineObjectViolations(sourceFile);
  }

  it('detects inline object in function parameter', () => {
    const violations = analyzeFile('inline-object-violations.ts');

    const paramViolation = violations.find(v =>
      v.context.includes('parameter') && v.line === 5
    );
    expect(paramViolation).toBeDefined();
  });

  it('detects inline object in function return type', () => {
    const violations = analyzeFile('inline-object-violations.ts');

    const returnViolation = violations.find(v =>
      v.context.includes('return') && v.line === 10
    );
    expect(returnViolation).toBeDefined();
  });

  it('detects inline object in variable declaration', () => {
    const violations = analyzeFile('inline-object-violations.ts');

    const varViolation = violations.find(v =>
      v.context.includes('variable') && v.line === 15
    );
    expect(varViolation).toBeDefined();
  });

  it('detects nested inline objects in type aliases', () => {
    const violations = analyzeFile('inline-object-violations.ts');

    const nestedViolations = violations.filter(v =>
      v.context.includes('nested') || v.line >= 25 && v.line <= 28
    );
    expect(nestedViolations.length).toBeGreaterThan(0);
  });

  it('does not flag empty object type', () => {
    const code = 'const x: {} = getData();';
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ES2020, true);
    const violations = collectInlineObjectViolations(sourceFile);

    expect(violations.length).toBe(0);
  });
});
