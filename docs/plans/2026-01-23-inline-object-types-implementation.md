# Inline Object Types Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the TypeScript linter to detect and flag all inline anonymous object types (e.g., `{ a: number }`) in addition to named single-use types.

**Architecture:** Add a recursive AST visitor to find all `ts.TypeLiteralNode` instances. Convert `Violation` to a discriminated union to handle both named and inline violations with type safety. Update reporter and suppression logic to handle line:column keys for inline objects.

**Tech Stack:** TypeScript, TypeScript Compiler API, Vitest

---

## Task 1: Update Type Definitions

**Files:**
- Modify: `src/types.ts:22-28`

**Step 1: Write failing test for discriminated violation types**

Create test file to verify type discrimination works:

```typescript
// test/types.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm test test/types.test.ts`

Expected: FAIL - Type errors since Violation is not yet a discriminated union

**Step 3: Update Violation type to discriminated union**

```typescript
// src/types.ts
export type Violation =
  | {
      kind: 'single-use-named';
      typeName: string;
      usedByFunction: string;
      filePath: string;
      line: number;
      column: number;
    }
  | {
      kind: 'inline-object';
      context: string;
      filePath: string;
      line: number;
      column: number;
    };
```

**Step 4: Run test to verify it passes**

Run: `pnpm test test/types.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts test/types.test.ts
git commit -m "feat: convert Violation to discriminated union for inline objects

Update Violation type to support both named single-use types and inline
object types with proper type discrimination."
```

---

## Task 2: Fix Analyzer to Create New Violation Format

**Files:**
- Modify: `src/analyzer.ts:103-125`

**Step 1: Update findViolations to create discriminated violations**

```typescript
// src/analyzer.ts (around line 103)
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
```

**Step 2: Run existing tests to verify they still pass**

Run: `pnpm test test/analyzer.test.ts`

Expected: PASS - All existing tests should still work

**Step 3: Commit**

```bash
git add src/analyzer.ts
git commit -m "refactor: update analyzer to use discriminated Violation type"
```

---

## Task 3: Fix Reporter to Handle Discriminated Violations

**Files:**
- Modify: `src/reporter.ts`

**Step 1: Read current reporter implementation**

Check how violations are currently formatted.

**Step 2: Add type guards for violation discrimination**

```typescript
// src/reporter.ts (add near top after imports)
import { Violation } from './types.js';

function isSingleUseNamedViolation(v: Violation): v is Extract<Violation, { kind: 'single-use-named' }> {
  return v.kind === 'single-use-named';
}

function isInlineObjectViolation(v: Violation): v is Extract<Violation, { kind: 'inline-object' }> {
  return v.kind === 'inline-object';
}
```

**Step 3: Update formatViolation function to handle both types**

```typescript
// src/reporter.ts (update existing function)
function formatViolation(violation: Violation): string {
  if (isSingleUseNamedViolation(violation)) {
    return `${violation.filePath}:${violation.line}:${violation.column} - Type '${violation.typeName}' is only used by function '${violation.usedByFunction}'`;
  } else {
    return `${violation.filePath}:${violation.line}:${violation.column} - Inline object type in ${violation.context}`;
  }
}
```

**Step 4: Run tests to verify reporting still works**

Run: `pnpm test`

Expected: PASS

**Step 5: Commit**

```bash
git add src/reporter.ts
git commit -m "refactor: update reporter to handle discriminated violations"
```

---

## Task 4: Fix Suppression Logic for Discriminated Violations

**Files:**
- Modify: `src/suppression.ts`

**Step 1: Read current suppression implementation**

Understand how suppressions are currently checked.

**Step 2: Update isSuppressed to handle both violation kinds**

```typescript
// src/suppression.ts (update existing function)
export function isSuppressed(
  violation: Violation,
  suppressions: SuppressionFile
): boolean {
  const relativePath = path.relative(process.cwd(), violation.filePath);
  const fileSuppressions = suppressions[relativePath];

  if (!fileSuppressions) {
    return false;
  }

  if (violation.kind === 'single-use-named') {
    return violation.typeName in fileSuppressions;
  } else {
    // Check for line:column key
    const locationKey = `${violation.line}:${violation.column}`;
    return locationKey in fileSuppressions;
  }
}
```

**Step 3: Update generateSuppressions to handle both kinds**

```typescript
// src/suppression.ts (update existing function)
export function generateSuppressions(violations: Violation[]): SuppressionFile {
  const suppressions: SuppressionFile = {};

  for (const violation of violations) {
    const relativePath = path.relative(process.cwd(), violation.filePath);

    if (!suppressions[relativePath]) {
      suppressions[relativePath] = {};
    }

    if (violation.kind === 'single-use-named') {
      suppressions[relativePath][violation.typeName] = {
        reason: 'TODO: Add reason for suppression',
      };
    } else {
      const locationKey = `${violation.line}:${violation.column}`;
      suppressions[relativePath][locationKey] = {
        reason: 'TODO: Add reason for suppression',
      };
    }
  }

  return suppressions;
}
```

**Step 4: Run suppression tests**

Run: `pnpm test test/suppression.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/suppression.ts
git commit -m "refactor: update suppression logic for discriminated violations"
```

---

## Task 5: Add Inline Object Detection - Test Fixtures

**Files:**
- Create: `test/fixtures/src/inline-object-violations.ts`

**Step 1: Create test fixture with inline object violations**

```typescript
// test/fixtures/src/inline-object-violations.ts
// @ts-nocheck
// File with intentional inline object type violations

// Function parameter
function processUser(user: { id: string; name: string }) {
  console.log(user.id, user.name);
}

// Function return type
function getConfig(): { timeout: number; retries: number } {
  return { timeout: 5000, retries: 3 };
}

// Variable declaration
const settings: { theme: string; lang: string } = {
  theme: 'dark',
  lang: 'en',
};

// Arrow function parameter
const handler = (opts: { x: number; y: number }) => {
  return opts.x + opts.y;
};

// Nested in type alias
type UserProfile = {
  personal: { firstName: string; lastName: string };
  contact: { email: string };
};

// In array type
const items: Array<{ id: number; label: string }> = [];

// Multiple parameters with inline objects
function merge(
  a: { value: number },
  b: { value: number }
): { value: number } {
  return { value: a.value + b.value };
}

// Index signature (should be flagged)
const map: { [key: string]: number } = {};

// Property declaration in class
class Widget {
  config: { width: number; height: number } = { width: 100, height: 100 };
}

// Type assertion
const data = JSON.parse('{}') as { name: string; age: number };
```

**Step 2: Commit fixture**

```bash
git add test/fixtures/src/inline-object-violations.ts
git commit -m "test: add fixture for inline object violations"
```

---

## Task 6: Add Inline Object Detection - Parser Logic

**Files:**
- Modify: `src/parser.ts` (add new function at end)

**Step 1: Write failing test for inline object detection**

```typescript
// test/parser.test.ts
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import * as path from 'path';
import { collectInlineObjectViolations } from '../src/parser.js';
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm test test/parser.test.ts`

Expected: FAIL - collectInlineObjectViolations doesn't exist yet

**Step 3: Implement collectInlineObjectViolations function**

```typescript
// src/parser.ts (add at end of file)

interface InlineObjectContext {
  description: string;
  functionName?: string;
}

function getInlineObjectContext(node: ts.Node, sourceFile: ts.SourceFile): InlineObjectContext {
  let current: ts.Node | undefined = node.parent;

  // Walk up to find meaningful context
  while (current) {
    if (ts.isParameter(current)) {
      const func = current.parent;
      const funcName = func && ts.isFunctionLike(func) ? getFunctionName(func) : undefined;
      return {
        description: 'function parameter',
        functionName: funcName,
      };
    }

    if (ts.isFunctionLike(current)) {
      const funcName = getFunctionName(current);
      // Check if this type node is the return type
      if (ts.isFunctionLike(current) && current.type) {
        return {
          description: 'function return type',
          functionName: funcName,
        };
      }
    }

    if (ts.isVariableDeclaration(current)) {
      return {
        description: 'variable declaration',
      };
    }

    if (ts.isPropertyDeclaration(current)) {
      return {
        description: 'property declaration',
      };
    }

    if (ts.isTypeAliasDeclaration(current) || ts.isInterfaceDeclaration(current)) {
      return {
        description: 'nested in type definition',
      };
    }

    if (ts.isAsExpression(current) || ts.isTypeAssertion(current)) {
      return {
        description: 'type assertion',
      };
    }

    current = current.parent;
  }

  return { description: 'unknown context' };
}

function isEmptyObjectType(node: ts.TypeLiteralNode): boolean {
  return node.members.length === 0;
}

export function collectInlineObjectViolations(
  sourceFile: ts.SourceFile
): Array<Extract<Violation, { kind: 'inline-object' }>> {
  const violations: Array<Extract<Violation, { kind: 'inline-object' }>> = [];

  function visitTypeNode(node: ts.Node): void {
    if (ts.isTypeLiteralNode(node)) {
      // Skip empty object types {}
      if (!isEmptyObjectType(node)) {
        const { line, column } = getLineAndColumn(node, sourceFile);
        const context = getInlineObjectContext(node, sourceFile);

        violations.push({
          kind: 'inline-object',
          context: context.description,
          filePath: sourceFile.fileName,
          line,
          column,
        });
      }
    }

    // Recursively visit child nodes
    ts.forEachChild(node, visitTypeNode);
  }

  visitTypeNode(sourceFile);
  return violations;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test test/parser.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/parser.ts test/parser.test.ts
git commit -m "feat: add inline object type detection to parser

Implement collectInlineObjectViolations to recursively find all
ts.TypeLiteralNode instances and extract context information."
```

---

## Task 7: Integrate Inline Detection into Analyzer

**Files:**
- Modify: `src/analyzer.ts:86-101,127-140`

**Step 1: Write failing test for analyzer integration**

```typescript
// test/analyzer.test.ts (add to existing file)
it('detects inline object violations', async () => {
  const result = await analyzeCodebase({
    targetDir: fixturesDir,
    specificFiles: [path.join(fixturesDir, 'src/inline-object-violations.ts')],
  });

  const inlineViolations = result.violations.filter(v => v.kind === 'inline-object');
  expect(inlineViolations.length).toBeGreaterThan(5);
});

it('combines named and inline violations', async () => {
  const result = await analyzeCodebase({
    targetDir: fixturesDir,
  });

  const namedViolations = result.violations.filter(v => v.kind === 'single-use-named');
  const inlineViolations = result.violations.filter(v => v.kind === 'inline-object');

  expect(namedViolations.length).toBeGreaterThan(0);
  expect(inlineViolations.length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test test/analyzer.test.ts`

Expected: FAIL - No inline violations found yet

**Step 3: Update analyzeSourceFiles to collect inline violations**

```typescript
// src/analyzer.ts (update function around line 86)
function analyzeSourceFiles(
  program: ts.Program,
  filesToAnalyze: string[]
): {
  typeDefinitions: Map<string, TypeDefinition>;
  typeUsages: Map<string, TypeUsage[]>;
  inlineViolations: Violation[];
} {
  const typeDefinitions = new Map<string, TypeDefinition>();
  const typeUsages = new Map<string, TypeUsage[]>();
  const inlineViolations: Violation[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile && filesToAnalyze.includes(sourceFile.fileName)) {
      collectTypeDefinitions(sourceFile, typeDefinitions);
      collectTypeUsages(sourceFile, typeUsages);
      const inline = collectInlineObjectViolations(sourceFile);
      inlineViolations.push(...inline);
    }
  }

  return { typeDefinitions, typeUsages, inlineViolations };
}
```

**Step 4: Update analyzeCodebase to merge violations**

```typescript
// src/analyzer.ts (update function around line 127)
export async function analyzeCodebase(options: AnalyzerOptions): Promise<AnalysisResult> {
  const filesToAnalyze = getFilesToAnalyze(options);
  const compilerOptions = getCompilerOptions();
  const program = ts.createProgram(filesToAnalyze, compilerOptions);

  const { typeDefinitions, typeUsages, inlineViolations } = analyzeSourceFiles(program, filesToAnalyze);
  const namedViolations = findViolations(typeDefinitions, typeUsages);

  // Combine both violation types
  const allViolations = [...namedViolations, ...inlineViolations];

  return {
    violations: allViolations,
    totalTypesAnalyzed: typeDefinitions.size + inlineViolations.length,
    filesAnalyzed: filesToAnalyze.length,
  };
}
```

**Step 5: Add import for collectInlineObjectViolations**

```typescript
// src/analyzer.ts (update imports at top)
import { collectTypeDefinitions, collectTypeUsages, extendsOtherType, collectInlineObjectViolations } from './parser.js';
```

**Step 6: Run test to verify it passes**

Run: `pnpm test test/analyzer.test.ts`

Expected: PASS

**Step 7: Commit**

```bash
git add src/analyzer.ts test/analyzer.test.ts
git commit -m "feat: integrate inline object detection into analyzer

Merge inline object violations with named single-use violations in
analysis results."
```

---

## Task 8: Test End-to-End Detection

**Files:**
- Test existing functionality

**Step 1: Run all tests**

Run: `pnpm test`

Expected: All tests PASS

**Step 2: Build the project**

Run: `pnpm run build`

Expected: Clean build with no errors

**Step 3: Test on fixture files manually**

Run: `pnpm run dev --files test/fixtures/src/inline-object-violations.ts`

Expected: Output showing inline object violations with file paths and line numbers

**Step 4: Verify named violations still work**

Run: `pnpm run dev --files test/fixtures/src/single-use-violations.ts`

Expected: Output showing named single-use type violations

**Step 5: Test combined output**

Run: `pnpm run dev --target-dir test/fixtures`

Expected: Output showing both named and inline violations

**Step 6: Commit if any fixes needed**

```bash
git add .
git commit -m "fix: adjust detection logic based on manual testing"
```

---

## Task 9: Enhanced Reporter Output

**Files:**
- Modify: `src/reporter.ts`

**Step 1: Add grouping logic for violations**

```typescript
// src/reporter.ts (add helper function)
function groupViolationsByKind(violations: Violation[]): {
  named: Array<Extract<Violation, { kind: 'single-use-named' }>>;
  inline: Array<Extract<Violation, { kind: 'inline-object' }>>;
} {
  const named: Array<Extract<Violation, { kind: 'single-use-named' }>> = [];
  const inline: Array<Extract<Violation, { kind: 'inline-object' }>> = [];

  for (const v of violations) {
    if (v.kind === 'single-use-named') {
      named.push(v);
    } else {
      inline.push(v);
    }
  }

  return { named, inline };
}
```

**Step 2: Update main report function to group output**

```typescript
// src/reporter.ts (update main export function)
export function reportViolations(violations: Violation[]): void {
  if (violations.length === 0) {
    console.log('✓ No single-use types found');
    return;
  }

  const { named, inline } = groupViolationsByKind(violations);

  if (named.length > 0) {
    console.log(`\n❌ Found ${named.length} single-use named type(s):\n`);
    named.forEach(v => console.log(formatViolation(v)));
  }

  if (inline.length > 0) {
    console.log(`\n❌ Found ${inline.length} inline object type(s):\n`);
    inline.forEach(v => console.log(formatViolation(v)));
  }

  console.log(`\n💡 Total violations: ${violations.length}`);
}
```

**Step 3: Test reporter output**

Run: `pnpm run dev --target-dir test/fixtures`

Expected: Grouped output with separate sections for named and inline violations

**Step 4: Commit**

```bash
git add src/reporter.ts
git commit -m "feat: enhance reporter to group violations by kind

Separate output for named single-use types and inline object types."
```

---

## Task 10: Update Suppression Tests

**Files:**
- Modify: `test/suppression.test.ts`

**Step 1: Add test for inline object suppression**

```typescript
// test/suppression.test.ts (add tests)
import { describe, it, expect } from 'vitest';
import { isSuppressed, generateSuppressions } from '../src/suppression.js';
import type { Violation, SuppressionFile } from '../src/types.js';

describe('suppression with inline objects', () => {
  it('suppresses inline object by line:column', () => {
    const violation: Violation = {
      kind: 'inline-object',
      context: 'function parameter',
      filePath: '/project/src/foo.ts',
      line: 23,
      column: 15,
    };

    const suppressions: SuppressionFile = {
      'src/foo.ts': {
        '23:15': {
          reason: 'Legacy API',
        },
      },
    };

    expect(isSuppressed(violation, suppressions)).toBe(true);
  });

  it('generates suppressions for inline objects', () => {
    const violations: Violation[] = [
      {
        kind: 'single-use-named',
        typeName: 'BadOptions',
        usedByFunction: 'foo',
        filePath: '/project/src/test.ts',
        line: 10,
        column: 5,
      },
      {
        kind: 'inline-object',
        context: 'function parameter',
        filePath: '/project/src/test.ts',
        line: 20,
        column: 15,
      },
    ];

    const suppressions = generateSuppressions(violations);

    expect(suppressions['src/test.ts']['BadOptions']).toBeDefined();
    expect(suppressions['src/test.ts']['20:15']).toBeDefined();
  });

  it('does not suppress inline object with different location', () => {
    const violation: Violation = {
      kind: 'inline-object',
      context: 'function parameter',
      filePath: '/project/src/foo.ts',
      line: 23,
      column: 15,
    };

    const suppressions: SuppressionFile = {
      'src/foo.ts': {
        '25:10': {
          reason: 'Different location',
        },
      },
    };

    expect(isSuppressed(violation, suppressions)).toBe(false);
  });
});
```

**Step 2: Run suppression tests**

Run: `pnpm test test/suppression.test.ts`

Expected: PASS

**Step 3: Test --suppress-all flag**

Run: `pnpm run dev --target-dir test/fixtures --suppress-all`

Expected: Creates/updates suppression file with both named and inline suppressions

**Step 4: Verify suppression file format**

Check that `test/fixtures/single-use-types-suppressions.json` has line:column keys for inline objects.

**Step 5: Commit**

```bash
git add test/suppression.test.ts
git commit -m "test: add suppression tests for inline object violations"
```

---

## Task 11: Update Documentation

**Files:**
- Modify: `README.md`

**Step 1: Update "What Gets Flagged" section**

Add description of inline object detection to README:

```markdown
## What Gets Flagged

The tool flags:

### Named Single-Use Types
Object types/interfaces that:
- Are only used by a single function (in signature or body)
- Are not exported (public API types are allowed)
- Don't extend/implement other types (polymorphism is allowed)
- Don't end with `*Props` (React component props pattern - temporary exception)

### Inline Object Types
All inline anonymous object types such as:
- Function parameters: `function foo(opts: { a: number })`
- Return types: `function bar(): { success: boolean }`
- Variable declarations: `const x: { id: string } = ...`
- Nested in type definitions: `type User = { profile: { name: string } }`
- Type assertions: `data as { value: number }`
- Index signatures: `const map: { [key: string]: number } = {}`

**Exception:** Empty object type `{}` is allowed (TypeScript idiom for non-null object constraint).
```

**Step 2: Update suppression documentation**

```markdown
## Suppression Mechanism

Suppressions are stored in `<target-dir>/single-use-types-suppressions.json`:

```json
{
  "src/apollo/client.ts": {
    "MapsResultSetMergeOptions": {
      "reason": "Apollo Client type policy requires this shape"
    },
    "23:15": {
      "reason": "Legacy API requires inline type",
      "kind": "inline-object"
    }
  }
}
```

- Named types are keyed by type name
- Inline objects are keyed by `line:column` location
```

**Step 3: Update examples section**

```markdown
### Examples

```typescript
// ✗ Named single-use type
interface SearchOptions {
  query: string;
  page: number;
}
function search(opts: SearchOptions) { ... }

// ✗ Inline object type
function search(opts: { query: string; page: number }) { ... }

// ✓ Domain concept
interface SearchQuery {
  query: string;
  page: number;
}
function search(query: SearchQuery) { ... }

// ✓ Or inline if truly simple
function search(query: string, page: number) { ... }
```
```

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README with inline object type detection

Document new inline object detection feature and suppression format."
```

---

## Task 12: Final Integration Testing

**Files:**
- Test all features together

**Step 1: Clean build**

Run: `pnpm run clean && pnpm run build`

Expected: Clean build

**Step 2: Run full test suite**

Run: `pnpm test`

Expected: All tests PASS

**Step 3: Test on real project (self-check)**

Run: `pnpm run check-self`

Expected: Reports any violations in the linter's own codebase

**Step 4: Test CLI flags**

```bash
# Test changed-only flag
pnpm run dev --changed-only

# Test specific files
pnpm run dev --files test/fixtures/src/inline-object-violations.ts

# Test suppress-all
pnpm run dev --target-dir test/fixtures --suppress-all
```

Expected: All flags work correctly with both violation types

**Step 5: Run type checking**

Run: `pnpm run typecheck`

Expected: No type errors

**Step 6: Run linter**

Run: `pnpm run lint`

Expected: No lint errors

**Step 7: Final commit if needed**

```bash
git add .
git commit -m "chore: final integration and cleanup"
```

---

## Task 13: Version and Documentation

**Files:**
- Modify: `package.json`
- Create: `CHANGELOG.md` (if doesn't exist)

**Step 1: Update version**

```json
// package.json
{
  "version": "2.0.0"
}
```

**Step 2: Create or update CHANGELOG**

```markdown
# Changelog

## [2.0.0] - 2026-01-23

### Added
- Inline object type detection - now flags all anonymous object types (e.g., `{ a: number }`)
- Context-aware error messages for inline violations
- Line:column based suppressions for inline objects
- Grouped output separating named and inline violations

### Changed
- BREAKING: Violation type is now a discriminated union
- Enhanced reporter to handle both violation kinds
- Suppression format now supports both named types and line:column keys

### Technical
- Added `collectInlineObjectViolations` function to parser
- Refactored analyzer to merge named and inline violations
- Updated all tests to cover inline object detection

## [1.0.0] - Previous release
...
```

**Step 3: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 2.0.0 and update changelog"
```

---

## Success Criteria

- [ ] All tests pass (`pnpm test`)
- [ ] Clean build (`pnpm run build`)
- [ ] Type checking passes (`pnpm run typecheck`)
- [ ] Linting passes (`pnpm run lint`)
- [ ] Manual testing shows inline objects are detected
- [ ] Both named and inline violations can be suppressed
- [ ] Reporter output is clear and grouped by violation kind
- [ ] Documentation is updated
- [ ] Version is bumped appropriately

## Notes

- Follow TDD: Write test first, see it fail, implement, see it pass
- Commit after each task completion
- If a step reveals issues with previous tasks, fix them and commit separately
- The discriminated union provides compile-time safety for handling different violation types
- Empty object type `{}` is the only allowed inline object (TypeScript idiom)
