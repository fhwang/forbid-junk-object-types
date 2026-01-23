import { describe, it, expect } from 'vitest';
import type { Violation } from '../src/types.js';

describe('Violation types', () => {
  it('supports single-use-named violations', () => {
    const violation: Violation = {
      kind: 'single-use-named',
      typeName: 'BadOptions',
      usedByFunction: 'foo',
      filePath: '/test.ts',
      line: 10,
      column: 5,
    };

    if (violation.kind === 'single-use-named') {
      expect(violation.typeName).toBe('BadOptions');
      expect(violation.usedByFunction).toBe('foo');
    }
  });

  it('supports inline-object violations', () => {
    const violation: Violation = {
      kind: 'inline-object',
      context: 'function parameter',
      filePath: '/test.ts',
      line: 15,
      column: 20,
    };

    if (violation.kind === 'inline-object') {
      expect(violation.context).toBe('function parameter');
      expect(violation).not.toHaveProperty('typeName');
    }
  });
});
