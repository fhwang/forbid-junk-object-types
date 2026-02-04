# Forbid Inline Object Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the single-use type linter to flag anonymous inline object types (e.g., `{ name: string }`) everywhere except generic constraints.

**Architecture:** Add `collectInlineObjectTypes()` to parser.ts that walks AST for `TypeLiteral` nodes, checking parent context to exempt generic constraints. Add `InlineTypeViolation` type. Integrate into analyzer and reporter.

**Tech Stack:** TypeScript Compiler API (ts.TypeLiteral, ts.TypeParameter), vitest for testing.

---

### Task 1: Add InlineTypeViolation type

**Files:**
- Modify: `src/types.ts:22-28`

**Step 1: Write failing test**

Create: `test/inline-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { InlineTypeViolation } from '../src/types.js';

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
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/inline-types.test.ts`
Expected: FAIL with "has no exported member 'InlineTypeViolation'"

**Step 3: Write minimal implementation**

In `src/types.ts`, add after line 28 (after `Violation` interface):

```typescript
export interface InlineTypeViolation {
  filePath: string;
  line: number;
  column: number;
  context: string;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/inline-types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts test/inline-types.test.ts
git commit -m "feat: add InlineTypeViolation type"
```

---

### Task 2: Add test fixture for inline type violations

**Files:**
- Create: `test/fixtures/src/inline-type-violations.ts`

**Step 1: Create fixture file**

```typescript
// @ts-nocheck
// File with inline object types that should be flagged

// Should flag: inline type in parameter
function withParam(opts: { name: string; count: number }) {
  console.log(opts.name, opts.count);
}

// Should flag: inline type in return type
function withReturn(): { success: boolean; message: string } {
  return { success: true, message: 'ok' };
}

// Should flag: inline type in variable declaration
const config: { timeout: number; retries: number } = { timeout: 5000, retries: 3 };

// Should flag: inline type in type assertion
declare const response: unknown;
const data = response as { id: string; value: number };

// Should flag: inline type in generic argument
const map: Map<string, { count: number }> = new Map();

// Should flag: inline type in destructured parameter
function withDestructure({ x, y }: { x: number; y: number }) {
  return x + y;
}

// Should flag: inline type in interface property
interface Parent {
  nested: { value: string };
}

// Ensure file is treated as module
export {};
```

**Step 2: Commit**

```bash
git add test/fixtures/src/inline-type-violations.ts
git commit -m "test: add fixture for inline type violations"
```

---

### Task 3: Add test fixture for valid inline types (generic constraints)

**Files:**
- Create: `test/fixtures/src/inline-types-valid.ts`

**Step 1: Create fixture file**

```typescript
// @ts-nocheck
// File with valid patterns that should NOT be flagged

// Should NOT flag: generic constraint (exempted)
function withConstraint<T extends { id: string }>(item: T) {
  return item.id;
}

// Should NOT flag: generic constraint with multiple properties
function withComplexConstraint<T extends { id: string; name: string }>(item: T) {
  return item.id + item.name;
}

// Should NOT flag: named types (existing behavior)
interface Options {
  name: string;
}

function withNamed(opts: Options) {
  console.log(opts.name);
}

// Ensure file is treated as module
export {};
```

**Step 2: Commit**

```bash
git add test/fixtures/src/inline-types-valid.ts
git commit -m "test: add fixture for valid inline types (generic constraints)"
```

---

### Task 4: Implement collectInlineObjectTypes in parser.ts

**Files:**
- Modify: `src/parser.ts`

**Step 1: Write failing test**

Add to `test/inline-types.test.ts`:

```typescript
import * as ts from 'typescript';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { collectInlineObjectTypes } from '../src/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('collectInlineObjectTypes', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  function createProgram(filePath: string): ts.Program {
    return ts.createProgram([filePath], {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: false,
    });
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
    expect(propViolation?.line).toBe(30);
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/inline-types.test.ts`
Expected: FAIL with "has no exported member 'collectInlineObjectTypes'"

**Step 3: Write implementation**

Add to `src/parser.ts` at the end:

```typescript
import { InlineTypeViolation } from './types.js';

function isGenericConstraint(node: ts.TypeLiteralNode): boolean {
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;
    // Check if this TypeLiteral is the constraint of a TypeParameter
    if (ts.isTypeParameterDeclaration(parent) && parent.constraint === current) {
      return true;
    }
    current = parent;
  }
  return false;
}

function getInlineTypeContext(node: ts.TypeLiteralNode, sourceFile: ts.SourceFile): string | null {
  const parent = node.parent;

  // Function parameter: function foo(x: { ... })
  if (ts.isParameter(parent)) {
    // Check if destructured: function foo({ x }: { ... })
    if (ts.isObjectBindingPattern(parent.name)) {
      return 'destructured parameter';
    }
    const paramName = ts.isIdentifier(parent.name) ? parent.name.text : 'unknown';
    return `parameter '${paramName}'`;
  }

  // Return type: function foo(): { ... }
  if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent) ||
      ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
    return 'return type';
  }

  // Variable declaration: const x: { ... } = ...
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return `variable '${parent.name.text}'`;
  }

  // Type assertion: value as { ... }
  if (ts.isAsExpression(parent)) {
    return 'type assertion';
  }

  // Generic argument: Map<string, { ... }>
  if (ts.isTypeReferenceNode(parent) && parent.typeArguments?.includes(node)) {
    return 'generic argument';
  }

  // Property signature: interface Foo { prop: { ... } }
  if (ts.isPropertySignature(parent) && ts.isIdentifier(parent.name)) {
    return `property '${parent.name.text}'`;
  }

  // Property declaration in class: class Foo { prop: { ... } }
  if (ts.isPropertyDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return `property '${parent.name.text}'`;
  }

  return null;
}

export function collectInlineObjectTypes(sourceFile: ts.SourceFile): InlineTypeViolation[] {
  const violations: InlineTypeViolation[] = [];

  function visit(node: ts.Node): void {
    if (ts.isTypeLiteralNode(node)) {
      // Skip generic constraints
      if (isGenericConstraint(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      const context = getInlineTypeContext(node, sourceFile);
      if (context) {
        const { line, column } = getLineAndColumn(node, sourceFile);
        violations.push({
          filePath: sourceFile.fileName,
          line,
          column,
          context,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}
```

Also update the import at the top of `src/parser.ts`:

```typescript
import { TypeDefinition, TypeUsage, InlineTypeViolation } from './types.js';
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/inline-types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/parser.ts test/inline-types.test.ts
git commit -m "feat: implement collectInlineObjectTypes parser function"
```

---

### Task 5: Update AnalysisResult to include inline violations

**Files:**
- Modify: `src/types.ts:43-47`

**Step 1: Write failing test**

Add to `test/inline-types.test.ts`:

```typescript
import { AnalysisResult, InlineTypeViolation } from '../src/types.js';

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
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/inline-types.test.ts`
Expected: FAIL with "inlineViolations does not exist"

**Step 3: Write implementation**

Update `AnalysisResult` in `src/types.ts`:

```typescript
export interface AnalysisResult {
  violations: Violation[];
  inlineViolations: InlineTypeViolation[];
  totalTypesAnalyzed: number;
  filesAnalyzed: number;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/inline-types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts test/inline-types.test.ts
git commit -m "feat: add inlineViolations to AnalysisResult"
```

---

### Task 6: Integrate collectInlineObjectTypes into analyzer

**Files:**
- Modify: `src/analyzer.ts`

**Step 1: Write failing test**

Add to `test/inline-types.test.ts`:

```typescript
import { analyzeCodebase } from '../src/analyzer.js';

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
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/inline-types.test.ts`
Expected: FAIL - inlineViolations not populated

**Step 3: Write implementation**

Update `src/analyzer.ts`:

Add import:
```typescript
import { collectTypeDefinitions, collectTypeUsages, extendsOtherType, collectInlineObjectTypes } from './parser.js';
```

Update `analyzeSourceFiles` function:
```typescript
function analyzeSourceFiles(
  program: ts.Program,
  filesToAnalyze: string[]
): { typeDefinitions: Map<string, TypeDefinition>; typeUsages: Map<string, TypeUsage[]>; inlineViolations: InlineTypeViolation[] } {
  const typeDefinitions = new Map<string, TypeDefinition>();
  const typeUsages = new Map<string, TypeUsage[]>();
  const inlineViolations: InlineTypeViolation[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile && filesToAnalyze.includes(sourceFile.fileName)) {
      collectTypeDefinitions(sourceFile, typeDefinitions);
      collectTypeUsages(sourceFile, typeUsages);
      inlineViolations.push(...collectInlineObjectTypes(sourceFile));
    }
  }

  return { typeDefinitions, typeUsages, inlineViolations };
}
```

Update import at top:
```typescript
import { TypeDefinition, TypeUsage, Violation, AnalyzerOptions, AnalysisResult, InlineTypeViolation } from './types.js';
```

Update `analyzeCodebase` function:
```typescript
export async function analyzeCodebase(options: AnalyzerOptions): Promise<AnalysisResult> {
  const filesToAnalyze = getFilesToAnalyze(options);
  const compilerOptions = getCompilerOptions();
  const program = ts.createProgram(filesToAnalyze, compilerOptions);

  const { typeDefinitions, typeUsages, inlineViolations } = analyzeSourceFiles(program, filesToAnalyze);
  const violations = findViolations(typeDefinitions, typeUsages);

  return {
    violations,
    inlineViolations,
    totalTypesAnalyzed: typeDefinitions.size,
    filesAnalyzed: filesToAnalyze.length,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/inline-types.test.ts`
Expected: PASS

**Step 5: Run all tests to ensure no regressions**

Run: `pnpm exec vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/analyzer.ts test/inline-types.test.ts
git commit -m "feat: integrate inline type detection into analyzer"
```

---

### Task 7: Update reporter to display inline violations

**Files:**
- Modify: `src/reporter.ts`

**Step 1: Write implementation**

Add to `src/reporter.ts`:

```typescript
import { Violation, InlineTypeViolation } from './types.js';

function reportSingleInlineViolation(violation: InlineTypeViolation, targetDir: string): void {
  const relativePath = path.relative(targetDir, violation.filePath);
  console.error(`${relativePath}:${violation.line}:${violation.column}`);
  console.error(`  Inline object type in ${violation.context}. Extract to a named type.`);
  console.error('');
}

export function reportInlineViolations(violations: InlineTypeViolation[], targetDir: string): void {
  if (violations.length === 0) return;

  console.error(`\nFound ${violations.length} inline object type violation(s):\n`);

  for (const violation of violations) {
    reportSingleInlineViolation(violation, targetDir);
  }

  reportInlineGuidance();
}

function reportInlineGuidance(): void {
  console.error('Inline object types should be extracted to named types that describe domain concepts.');
  console.error('');
  console.error('Instead of:  function process(opts: { timeout: number; retries: number })');
  console.error('Use:         function process(opts: RetryPolicy)');
}
```

Update import:
```typescript
import { Violation, InlineTypeViolation } from './types.js';
```

**Step 2: Run all tests**

Run: `pnpm exec vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/reporter.ts
git commit -m "feat: add reportInlineViolations to reporter"
```

---

### Task 8: Update CLI to report inline violations

**Files:**
- Modify: `src/index.ts`

**Step 1: Read current index.ts**

Read the file to understand current CLI structure.

**Step 2: Write implementation**

Update `src/index.ts` to call `reportInlineViolations` and include inline violations in exit code:

Add import:
```typescript
import { reportViolations, reportSuccess, reportSummary, reportInlineViolations } from './reporter.js';
```

Update the reporting section to include inline violations in the decision to exit with error:

```typescript
const hasViolations = result.violations.length > 0 || result.inlineViolations.length > 0;

if (result.violations.length > 0) {
  reportViolations(result.violations, targetDir);
}

if (result.inlineViolations.length > 0) {
  reportInlineViolations(result.inlineViolations, targetDir);
}

if (!hasViolations) {
  reportSuccess();
}

reportSummary(result.totalTypesAnalyzed, result.filesAnalyzed);

process.exit(hasViolations ? 1 : 0);
```

**Step 3: Run manual test**

Run: `pnpm exec tsx src/index.ts --target-dir test/fixtures`
Expected: Should show both single-use type violations AND inline type violations

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: report inline violations in CLI output"
```

---

### Task 9: Update success message

**Files:**
- Modify: `src/reporter.ts`

**Step 1: Write implementation**

Update `reportSuccess` to mention both violation types:

```typescript
export function reportSuccess(): void {
  console.log('✓ No type violations found!');
}
```

**Step 2: Commit**

```bash
git add src/reporter.ts
git commit -m "chore: update success message for both violation types"
```

---

### Task 10: Final integration test

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `pnpm exec vitest run`
Expected: All tests pass

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run type check**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 4: Manual CLI test**

Run: `pnpm exec tsx src/index.ts --target-dir test/fixtures`
Expected: Should report both single-use and inline type violations

**Step 5: Commit any fixes if needed**

---

### Task 11: Update suppression to handle inline violations

**Files:**
- Modify: `src/suppression.ts`
- Modify: `src/index.ts`

**Step 1: Update suppression to support inline violations**

The current suppression uses `filePath:typeName` as key. For inline violations, use `filePath:line:column` since there's no type name.

Add to `src/suppression.ts`:

```typescript
import { InlineTypeViolation } from './types.js';

export function isInlineSuppressed(
  violation: InlineTypeViolation,
  suppressions: SuppressionFile,
  targetDir: string
): boolean {
  const relativePath = path.relative(targetDir, violation.filePath);
  const key = `inline:${violation.line}:${violation.column}`;
  return relativePath in suppressions && key in suppressions[relativePath];
}

export function generateInlineSuppressions(
  violations: InlineTypeViolation[],
  targetDir: string
): SuppressionFile {
  const suppressions: SuppressionFile = {};

  for (const violation of violations) {
    const relativePath = path.relative(targetDir, violation.filePath);
    const key = `inline:${violation.line}:${violation.column}`;

    if (!suppressions[relativePath]) {
      suppressions[relativePath] = {};
    }
    suppressions[relativePath][key] = { reason: violation.context };
  }

  return suppressions;
}
```

**Step 2: Update index.ts to filter suppressed inline violations**

Add filtering logic similar to existing single-use type suppression filtering.

**Step 3: Run all tests**

Run: `pnpm exec vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/suppression.ts src/index.ts
git commit -m "feat: support suppression for inline type violations"
```
