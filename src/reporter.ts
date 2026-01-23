import * as path from 'path';
import { Violation } from './types.js';

function reportSingleViolation(violation: Violation, targetDir: string): void {
  const relativePath = path.relative(targetDir, violation.filePath);
  console.error(`${relativePath}:${violation.line}:${violation.column}`);
  console.error(`  ${violation.typeName} is only used by function '${violation.usedByFunction}'`);
  console.error(`  Consider inlining this type or creating a domain concept instead`);
  console.error('');
}

function reportGuidance(): void {
  console.error('Single-use types often indicate missing domain modeling.');
  console.error('Instead of generic names like *Props, *Options, *Config,');
  console.error('create types that describe actual domain concepts.');
  console.error('');
  console.error('Example:');
  console.error('  ✗ interface SearchOptions { query: string, page: number }');
  console.error('  ✓ interface SearchQuery { query: string, page: number }');
  console.error('  ✓ Or inline if truly one-off: (query: string, page: number) => ...');
}

export function reportViolations(violations: Violation[], targetDir: string): void {
  console.error(`\nFound ${violations.length} single-use type violation(s):\n`);

  for (const violation of violations) {
    reportSingleViolation(violation, targetDir);
  }

  reportGuidance();
}

export function reportSuccess(): void {
  console.log('✓ No single-use type violations found!');
}

export function reportSummary(totalTypesAnalyzed: number, filesAnalyzed: number): void {
  console.log(`\nAnalyzed ${totalTypesAnalyzed} type(s) across ${filesAnalyzed} file(s)`);
}
