# Inline Object Types Detection Design

## Overview

Extend the linter to detect and flag inline anonymous object types in addition to named single-use types. This enforces the principle that all object shapes should have meaningful domain names.

## Problem Statement

The current linter only detects named types (interfaces and type aliases) that are used by a single function. However, developers can bypass this by using inline anonymous object types:

```typescript
// Currently flagged
interface BadOptions {
  a: number;
  b: number;
}
function foo(opts: BadOptions) { ... }

// Currently NOT flagged, but should be
function foo(opts: { a: number; b: number }) { ... }
```

Inline anonymous object types are inherently single-use and represent the same anti-pattern: missing domain modeling.

## Scope

Flag ALL inline object types regardless of:
- Location (function parameters, return types, variables, nested in other types, etc.)
- Complexity (even single-property objects)
- Context (no exceptions for "common patterns")

This ensures complete consistency: every object shape must have a meaningful name.

## Detection Strategy

### Key Detection Points

1. Function parameters: `function foo(x: { a: number })`
2. Function return types: `function foo(): { success: boolean }`
3. Variable declarations: `const x: { id: string } = ...`
4. Type assertions: `data as { name: string }`
5. Property declarations: `class Foo { prop: { x: number } }`
6. Nested in named types: `type User = { profile: { avatar: string } }`
7. Array/generic type arguments: `Array<{ id: string }>`

### Detection Approach

- Add a new AST visitor function `collectInlineObjectTypes()` in `parser.ts`
- Recursively walk all type nodes looking for `ts.TypeLiteralNode`
- Track location (file, line, column) and context (function name, parent type)
- Unlike named types which need usage counting, inline types are violations by definition
- Store as a separate violation category since they don't have type names

### No Exceptions

Flag ALL inline object literals, even when nested in named types. This ensures complete consistency - every object shape must have a meaningful name.

## Data Model Changes

### Current Model

```typescript
interface Violation {
  typeName: string;
  filePath: string;
  line: number;
  column: number;
  usedByFunction: string;
}
```

### New Model

```typescript
type Violation =
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
      context: string;  // e.g., "function parameter", "variable declaration"
      filePath: string;
      line: number;
      column: number;
    }
```

This discriminated union provides type safety and makes it clear that the two violation types have different properties.

## Error Messages and Reporting

### Proposed Error Format

```
src/foo.ts:23:15 - Inline object type in function parameter
  function foo(opts: { a: number, b: number }): boolean
                     ^
  Extract to a named type or inline the parameters.

src/bar.ts:45:7 - Inline object type in variable declaration
  const x: { id: string } = getData()
           ^
  Extract to a named type or use a primitive type.

src/user.ts:12:18 - Inline object type nested in type definition
  type User = { profile: { avatar: string } }
                          ^
  Extract nested object to a named type.
```

### Key Elements

- Context description (parameter, return type, variable, nested, etc.)
- Line/column pointer to the inline object
- Actionable guidance based on context

### Reporter Changes

- Update `reporter.ts` to handle both violation kinds using type guards
- Group violations by type (named vs inline) in output
- Adjust formatting logic to accommodate different message templates

## Suppression Mechanism

### Current Format

```json
{
  "src/apollo/client.ts": {
    "MapsResultSetMergeOptions": {
      "reason": "Apollo Client type policy requires this shape"
    }
  }
}
```

### New Format

Use `line:column` as the key for inline object suppressions:

```json
{
  "src/foo.ts": {
    "BadOptions": {
      "reason": "Legacy API shape"
    },
    "23:15": {
      "reason": "React hook tuple convention",
      "kind": "inline-object"
    }
  }
}
```

### Key Properties

- Line:column uniquely identifies the inline object location
- Add optional `kind` field to distinguish suppression types
- `--suppress-all` generates suppressions for both named and inline violations
- Suppressions are checked by matching file + (typeName OR line:column)

### Trade-offs

- Pro: Simple, doesn't break existing suppressions
- Con: Line numbers can shift when code changes (but this is acceptable - it forces re-review)

## Implementation Plan

### Files to Modify

1. **`src/types.ts`** - Update data model
   - Change `Violation` to discriminated union
   - Add `InlineObjectContext` type for tracking where inline objects appear

2. **`src/parser.ts`** - Add inline object detection
   - Add `collectInlineObjectTypes()` function
   - Create recursive type node visitor
   - Extract context information (function name, parent type, etc.)
   - Return `Violation[]` directly (no usage tracking needed)

3. **`src/analyzer.ts`** - Integrate inline detection
   - Call `collectInlineObjectTypes()` alongside existing collectors
   - Merge inline violations with named-type violations
   - Update `findViolations()` to handle both violation kinds

4. **`src/reporter.ts`** - Update output formatting
   - Add type guards for violation discrimination
   - Implement context-specific error messages
   - Group/sort violations by kind

5. **`src/suppression.ts`** - Support line:column keys
   - Update `isSuppressed()` to check both typeName and line:column
   - Update suppression file writing to handle both formats
   - Ensure `--suppress-all` works for inline objects

6. **`test/fixtures/`** - Add test cases
   - Create `inline-object-violations.ts` with various inline object patterns
   - Update `analyzer.test.ts` to verify inline detection

### Implementation Order

1. Types (foundation)
2. Parser (detection logic)
3. Analyzer (integration)
4. Reporter (output)
5. Suppression (persistence)
6. Tests (verification)

## Edge Cases and Special Considerations

### 1. Empty Object Types

```typescript
const x: {} = getData()
```

**Decision:** Don't flag - `{}` is idiomatic TypeScript for "any non-null object" constraint.

### 2. Mapped Types and Conditional Types

```typescript
type Foo = { [K in Keys]: { value: string } }
type Bar = SomeCondition ? { x: number } : { y: string }
```

**Decision:** Flag them - still inline objects that should be extracted for clarity.

### 3. Function Types Within Objects

```typescript
const handler: { onClick: (e: Event) => void } = ...
```

**Decision:** Already handled correctly - we're only looking for `ts.TypeLiteralNode`, not function types.

### 4. Index Signatures

```typescript
const map: { [key: string]: number } = {}
```

**Decision:** Flag it - should be `Record<string, number>` or a named type.

### 5. Tuple Types and Arrays

```typescript
const pair: [{ x: number }, { y: number }] = ...
```

**Decision:** Flag them - our recursive visitor will catch nested inline objects.

## Success Criteria

1. All inline object types are detected and reported
2. Error messages provide clear, actionable guidance
3. Suppression mechanism works for both named and inline violations
4. Tests cover all detection points and edge cases
5. No false negatives (missing inline objects)
6. Only one false positive allowed: `{}` (empty object type)

## Philosophy Alignment

This change reinforces the core philosophy: if an object shape is worth typing, it's worth naming properly. Either:
1. Extract to a named type that describes the domain concept
2. Or inline the individual parameters/properties

No middle ground of anonymous inline objects.
