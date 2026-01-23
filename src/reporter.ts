import * as path from 'path';
import { Violation, SingleUseNamedViolation, InlineObjectViolation } from './types.js';

function isSingleUseNamedViolation(v: Violation): v is SingleUseNamedViolation {
  return v.kind === 'single-use-named';
}

function isInlineObjectViolation(v: Violation): v is InlineObjectViolation {
  return v.kind === 'inline-object';
}

function reportSingleViolation(violation: Violation, targetDir: string): void {
  const relativePath = path.relative(targetDir, violation.filePath);
  console.error(`${relativePath}:${violation.line}:${violation.column}`);

  if (isSingleUseNamedViolation(violation)) {
    console.error(`  ${violation.typeName} is only used by function '${violation.usedByFunction}'`);
    console.error(`  Consider inlining this type or creating a domain concept instead`);
  } else if (isInlineObjectViolation(violation)) {
    console.error(`  Inline object type in ${violation.context}`);
    console.error(`  Consider extracting this to a named type if it represents a domain concept`);
  } else {
    const _exhaustive: never = violation;
    throw new Error(`Unhandled violation kind: ${JSON.stringify(_exhaustive)}`);
  }

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

function groupViolationsByKind(violations: Violation[]): {
  named: SingleUseNamedViolation[];
  inline: InlineObjectViolation[];
} {
  const named: SingleUseNamedViolation[] = [];
  const inline: InlineObjectViolation[] = [];

  for (const v of violations) {
    if (v.kind === 'single-use-named') {
      named.push(v);
    } else {
      inline.push(v);
    }
  }

  return { named, inline };
}

function reportNamedViolations(violations: SingleUseNamedViolation[], targetDir: string): void {
  if (violations.length === 0) return;
  console.error(`\n❌ Found ${violations.length} single-use named type(s):\n`);
  for (const violation of violations) {
    reportSingleViolation(violation, targetDir);
  }
}

function reportInlineViolations(violations: InlineObjectViolation[], targetDir: string): void {
  if (violations.length === 0) return;
  console.error(`\n❌ Found ${violations.length} inline object type(s):\n`);
  for (const violation of violations) {
    reportSingleViolation(violation, targetDir);
  }
}

export function reportViolations(violations: Violation[], targetDir: string): void {
  if (violations.length === 0) {
    console.log('✓ No single-use types found');
    return;
  }

  const { named, inline } = groupViolationsByKind(violations);
  reportNamedViolations(named, targetDir);
  reportInlineViolations(inline, targetDir);
  console.error(`\n💡 Total violations: ${violations.length}\n`);
  reportGuidance();
}

export function reportSuccess(): void {
  console.log('✓ No single-use type violations found!');
}

export function reportSummary(totalTypesAnalyzed: number, filesAnalyzed: number): void {
  console.log(`\nAnalyzed ${totalTypesAnalyzed} type(s) across ${filesAnalyzed} file(s)`);
}
