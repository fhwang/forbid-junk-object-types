import { describe, it, expect } from 'vitest';
import { analyzeCodebase } from '../src/analyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('analyzer', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  it('detects single-use interface violations', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/single-use-violations.ts')],
    });

    expect(result.violations.length).toBeGreaterThan(0);
    const typeNames = result.violations.map(v => v.typeName);
    expect(typeNames).toContain('SingleUseInterface');
    expect(typeNames).toContain('SingleUseType');
    expect(typeNames).toContain('BadOptions');
  });

  it('does not flag types used by multiple functions', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/valid-types.ts')],
    });

    const typeNames = result.violations.map(v => v.typeName);
    expect(typeNames).not.toContain('MultiUseType');
  });

  it('does not flag exported types', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/valid-types.ts')],
    });

    const typeNames = result.violations.map(v => v.typeName);
    expect(typeNames).not.toContain('PublicAPI');
  });

  it('does not flag types in inheritance hierarchies', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/valid-types.ts')],
    });

    const typeNames = result.violations.map(v => v.typeName);
    expect(typeNames).not.toContain('ExtendedInterface');
  });

  it('does not flag React Props pattern', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/valid-types.ts')],
    });

    const typeNames = result.violations.map(v => v.typeName);
    // ComponentProps ends with Props, so should be allowed
    expect(typeNames).not.toContain('ComponentProps');
  });

  it('correctly handles mixed files with both violations and valid types', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/mixed-types.ts')],
    });

    const typeNames = result.violations.map(v => v.typeName);

    // Should flag these
    expect(typeNames).toContain('BadConfig');
    expect(typeNames).toContain('SingleParam');

    // Should not flag this (multi-use)
    expect(typeNames).not.toContain('GoodUser');
  });

  it('reports correct file paths and line numbers', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/single-use-violations.ts')],
    });

    const violation = result.violations.find(v => v.typeName === 'SingleUseInterface');
    expect(violation).toBeDefined();
    expect(violation?.filePath).toContain('single-use-violations.ts');
    expect(violation?.line).toBeGreaterThan(0);
    expect(violation?.usedByFunction).toBe('useSingleInterface');
  });

  it('analyzes multiple files when no specific files provided', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
    });

    expect(result.filesAnalyzed).toBeGreaterThan(1);
    expect(result.totalTypesAnalyzed).toBeGreaterThan(0);
  });
});
