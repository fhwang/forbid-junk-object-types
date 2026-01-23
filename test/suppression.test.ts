import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadSuppressions,
  saveSuppressions,
  isSuppressed,
  generateSuppressionsForAll,
  mergeSuppressions,
} from '../src/suppression.js';
import { Violation, SuppressionFile } from '../src/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('suppression', () => {
  let tempDir: string;
  let suppressionPath: string;

  beforeEach(() => {
    // Create a temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'suppression-test-'));
    suppressionPath = path.join(tempDir, 'suppressions.json');
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadSuppressions', () => {
    it('returns empty object if file does not exist', () => {
      const suppressions = loadSuppressions(suppressionPath);
      expect(suppressions).toEqual({});
    });

    it('loads suppressions from existing file', () => {
      const testSuppressions: SuppressionFile = {
        'src/test.ts': {
          BadType: { reason: 'Test reason' },
        },
      };

      fs.writeFileSync(suppressionPath, JSON.stringify(testSuppressions));
      const loaded = loadSuppressions(suppressionPath);

      expect(loaded).toEqual(testSuppressions);
    });
  });

  describe('saveSuppressions', () => {
    it('saves suppressions to file', () => {
      const testSuppressions: SuppressionFile = {
        'src/test.ts': {
          BadType: { reason: 'Test reason' },
        },
      };

      saveSuppressions(testSuppressions, suppressionPath);

      expect(fs.existsSync(suppressionPath)).toBe(true);
      const content = fs.readFileSync(suppressionPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(testSuppressions);
    });
  });

  describe('isSuppressed', () => {
    it('returns true for suppressed violations', () => {
      const suppressions: SuppressionFile = {
        'src/test.ts': {
          BadType: { reason: 'Suppressed' },
        },
      };

      const violation: Violation = {
        kind: 'single-use-named',
        typeName: 'BadType',
        filePath: path.join(tempDir, 'src/test.ts'),
        line: 10,
        column: 1,
        usedByFunction: 'testFn',
      };

      expect(isSuppressed(violation, suppressions, tempDir)).toBe(true);
    });

    it('returns false for non-suppressed violations', () => {
      const suppressions: SuppressionFile = {};

      const violation: Violation = {
        kind: 'single-use-named',
        typeName: 'BadType',
        filePath: path.join(tempDir, 'src/test.ts'),
        line: 10,
        column: 1,
        usedByFunction: 'testFn',
      };

      expect(isSuppressed(violation, suppressions, tempDir)).toBe(false);
    });

    it('handles relative paths correctly', () => {
      const suppressions: SuppressionFile = {
        'src/nested/test.ts': {
          BadType: { reason: 'Suppressed' },
        },
      };

      const violation: Violation = {
        kind: 'single-use-named',
        typeName: 'BadType',
        filePath: path.join(tempDir, 'src/nested/test.ts'),
        line: 10,
        column: 1,
        usedByFunction: 'testFn',
      };

      expect(isSuppressed(violation, suppressions, tempDir)).toBe(true);
    });

    it('returns true for suppressed inline-object violations', () => {
      const suppressions: SuppressionFile = {
        'src/test.ts': {
          '10:5': { reason: 'Suppressed inline object' },
        },
      };

      const violation: Violation = {
        kind: 'inline-object',
        context: 'parameter of function foo',
        filePath: path.join(tempDir, 'src/test.ts'),
        line: 10,
        column: 5,
      };

      expect(isSuppressed(violation, suppressions, tempDir)).toBe(true);
    });

    it('returns false for non-suppressed inline-object violations', () => {
      const suppressions: SuppressionFile = {
        'src/test.ts': {
          '10:5': { reason: 'Different location' },
        },
      };

      const violation: Violation = {
        kind: 'inline-object',
        context: 'parameter of function bar',
        filePath: path.join(tempDir, 'src/test.ts'),
        line: 15,
        column: 3,
      };

      expect(isSuppressed(violation, suppressions, tempDir)).toBe(false);
    });
  });

  describe('generateSuppressionsForAll', () => {
    it('generates suppressions for all violations', () => {
      const violations: Violation[] = [
        {
          kind: 'single-use-named',
          typeName: 'Type1',
          filePath: path.join(tempDir, 'src/file1.ts'),
          line: 1,
          column: 1,
          usedByFunction: 'fn1',
        },
        {
          kind: 'single-use-named',
          typeName: 'Type2',
          filePath: path.join(tempDir, 'src/file2.ts'),
          line: 2,
          column: 1,
          usedByFunction: 'fn2',
        },
      ];

      const suppressions = generateSuppressionsForAll(violations, tempDir);

      expect(suppressions['src/file1.ts']!['Type1']).toBeDefined();
      expect(suppressions['src/file2.ts']!['Type2']).toBeDefined();
      expect(suppressions['src/file1.ts']!['Type1']!.reason).toContain('Auto-suppressed');
    });

    it('generates suppressions for inline-object violations', () => {
      const violations: Violation[] = [
        {
          kind: 'inline-object',
          context: 'parameter of function foo',
          filePath: path.join(tempDir, 'src/file1.ts'),
          line: 10,
          column: 5,
        },
        {
          kind: 'inline-object',
          context: 'return type of function bar',
          filePath: path.join(tempDir, 'src/file2.ts'),
          line: 20,
          column: 15,
        },
      ];

      const suppressions = generateSuppressionsForAll(violations, tempDir);

      expect(suppressions['src/file1.ts']!['10:5']).toBeDefined();
      expect(suppressions['src/file2.ts']!['20:15']).toBeDefined();
      expect(suppressions['src/file1.ts']!['10:5']!.reason).toContain('Auto-suppressed');
    });

    it('generates suppressions for mixed violation types', () => {
      const violations: Violation[] = [
        {
          kind: 'single-use-named',
          typeName: 'Type1',
          filePath: path.join(tempDir, 'src/file1.ts'),
          line: 1,
          column: 1,
          usedByFunction: 'fn1',
        },
        {
          kind: 'inline-object',
          context: 'parameter of function foo',
          filePath: path.join(tempDir, 'src/file1.ts'),
          line: 10,
          column: 5,
        },
      ];

      const suppressions = generateSuppressionsForAll(violations, tempDir);

      expect(suppressions['src/file1.ts']!['Type1']).toBeDefined();
      expect(suppressions['src/file1.ts']!['10:5']).toBeDefined();
    });
  });

  describe('mergeSuppressions', () => {
    it('merges new suppressions with existing ones', () => {
      const existing: SuppressionFile = {
        'src/file1.ts': {
          Type1: { reason: 'Existing' },
        },
      };

      const newSuppressions: SuppressionFile = {
        'src/file2.ts': {
          Type2: { reason: 'New' },
        },
      };

      const merged = mergeSuppressions(existing, newSuppressions);

      expect(merged['src/file1.ts']!['Type1']!.reason).toBe('Existing');
      expect(merged['src/file2.ts']!['Type2']!.reason).toBe('New');
    });

    it('does not overwrite existing suppressions', () => {
      const existing: SuppressionFile = {
        'src/file1.ts': {
          Type1: { reason: 'Original' },
        },
      };

      const newSuppressions: SuppressionFile = {
        'src/file1.ts': {
          Type1: { reason: 'Should not override' },
        },
      };

      const merged = mergeSuppressions(existing, newSuppressions);

      expect(merged['src/file1.ts']!['Type1']!.reason).toBe('Original');
    });

    it('adds new types to existing files', () => {
      const existing: SuppressionFile = {
        'src/file1.ts': {
          Type1: { reason: 'Existing' },
        },
      };

      const newSuppressions: SuppressionFile = {
        'src/file1.ts': {
          Type2: { reason: 'New type in same file' },
        },
      };

      const merged = mergeSuppressions(existing, newSuppressions);

      expect(merged['src/file1.ts']!['Type1']!.reason).toBe('Existing');
      expect(merged['src/file1.ts']!['Type2']!.reason).toBe('New type in same file');
    });
  });
});
