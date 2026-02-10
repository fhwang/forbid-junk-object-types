import { describe, it, expect } from 'vitest';
import { analyzeCodebase } from '../src/analyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('analyzer', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const fixturesNoSrcDir = path.join(__dirname, 'fixtures-no-src');
  const fixturesCustomSrcDir = path.join(__dirname, 'fixtures-custom-src');

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

  it('flags exported types that are not imported elsewhere (single file)', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [path.join(fixturesDir, 'src/valid-types.ts')],
    });

    const typeNames = result.violations.map(v => v.typeName);
    // PublicAPI is exported but not imported by any other file in this analysis
    // so it should now be flagged as a single-use type
    expect(typeNames).toContain('PublicAPI');
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

  it('flags exported types that are not imported elsewhere', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [
        path.join(fixturesDir, 'src/exported-type-provider.ts'),
        path.join(fixturesDir, 'src/exported-type-consumer.ts'),
      ],
    });

    const typeNames = result.violations.map(v => v.typeName);
    // ExportedButLocalOnly is exported but not imported anywhere - should be flagged
    expect(typeNames).toContain('ExportedButLocalOnly');
  });

  it('does not flag exported types that are imported by other files', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [
        path.join(fixturesDir, 'src/exported-type-provider.ts'),
        path.join(fixturesDir, 'src/exported-type-consumer.ts'),
      ],
    });

    const typeNames = result.violations.map(v => v.typeName);
    // ImportedElsewhere is exported AND imported by exported-type-consumer.ts - should NOT be flagged
    expect(typeNames).not.toContain('ImportedElsewhere');
  });

  it('works with --files when target directory has no src/ subdirectory', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesNoSrcDir,
      specificFiles: [path.join(fixturesNoSrcDir, 'root-level-types.ts')],
    });

    expect(result.violations.length).toBeGreaterThan(0);
    const typeNames = result.violations.map(v => v.typeName);
    expect(typeNames).toContain('SingleUseConfig');
  });

  it('uses sourceDir option instead of hardcoded src/ when provided', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesCustomSrcDir,
      sourceDir: 'lib',
    });

    expect(result.filesAnalyzed).toBeGreaterThan(0);
    const typeNames = result.violations.map(v => v.typeName);
    expect(typeNames).toContain('CustomConfig');
  });

  it('does not flag types used as a field in a type alias', async () => {
    // ApiOrder is used as:
    // 1. A param in deserializeOrder (interface-field-usage.ts)
    // 2. A field in type alias ApiUser (interface-field-consumer.ts)
    // So it should NOT be flagged as single-use
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [
        path.join(fixturesDir, 'src/interface-field-usage.ts'),
        path.join(fixturesDir, 'src/interface-field-consumer.ts'),
      ],
    });

    const typeNames = result.violations.map(v => v.typeName);
    expect(typeNames).not.toContain('ApiOrder');
  });

  it('does not flag types used as a field in an intersection type alias', async () => {
    // ApiSubscription is used as:
    // 1. A param in cancelSubscription (intersection-type-consumer.ts)
    // 2. A field in type alias ApiUser which is an intersection (intersection-type-alias.ts)
    // So it should NOT be flagged as single-use
    const result = await analyzeCodebase({
      targetDir: fixturesDir,
      specificFiles: [
        path.join(fixturesDir, 'src/intersection-type-alias.ts'),
        path.join(fixturesDir, 'src/intersection-type-consumer.ts'),
      ],
    });

    const typeNames = result.violations.map(v => v.typeName);
    expect(typeNames).not.toContain('ApiSubscription');
  });

  it('defaults to target directory itself when no sourceDir and no src/ exists', async () => {
    const result = await analyzeCodebase({
      targetDir: fixturesNoSrcDir,
    });

    expect(result.filesAnalyzed).toBeGreaterThan(0);
    const typeNames = result.violations.map(v => v.typeName);
    expect(typeNames).toContain('SingleUseConfig');
  });
});
