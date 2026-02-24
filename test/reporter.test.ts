import { describe, it, expect, vi } from 'vitest';
import { reportViolations, reportInlineViolations } from '../src/reporter.js';
import { Violation, InlineTypeViolation } from '../src/types.js';

describe('reporter', () => {
  it('includes hints file reference in single-use violation output', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const violations: Violation[] = [{
      typeName: 'TestType',
      filePath: '/project/src/test.ts',
      line: 10,
      column: 1,
      usedByFunction: 'testFn',
    }];

    reportViolations(violations, '/project');

    const allOutput = errorSpy.mock.calls.map(call => call[0]).join('\n');
    expect(allOutput).toContain('node_modules/forbid-junk-object-types/docs/fixing-violations.md');
    errorSpy.mockRestore();
  });

  it('includes hints file reference in inline violation output', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const violations: InlineTypeViolation[] = [{
      filePath: '/project/src/test.ts',
      line: 10,
      column: 15,
      context: "parameter 'opts'",
    }];

    reportInlineViolations(violations, '/project');

    const allOutput = errorSpy.mock.calls.map(call => call[0]).join('\n');
    expect(allOutput).toContain('node_modules/forbid-junk-object-types/docs/fixing-violations.md');
    errorSpy.mockRestore();
  });
});
