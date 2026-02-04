# Forbid Inline Object Types

## Overview

Extend the single-use type linter to also flag anonymous inline object types. An inline object type is equivalent to a named object type with one use—both indicate missing domain modeling.

## Detection Scope

### What Gets Flagged

| Location | Example |
|----------|---------|
| Function parameter | `function foo(opts: { name: string })` |
| Return type | `function bar(): { success: boolean }` |
| Variable declaration | `const x: { count: number } = ...` |
| Type assertion | `value as { id: string }` |
| Generic type argument | `Map<string, { data: number }>` |
| Destructured parameter | `function foo({ x }: { x: number })` |
| Property type | `interface Foo { nested: { value: string } }` |

### What Gets Exempted

| Location | Example | Reason |
|----------|---------|--------|
| Generic constraint | `<T extends { id: string }>` | Structural constraint, not a domain type |

## Detection Mechanism

In TypeScript's AST, inline object types are `TypeLiteral` nodes. Walk the AST, find all `TypeLiteral` nodes, check if parent is a type parameter constraint. If so, exempt; otherwise, flag.

## Implementation

### Module Changes

**`parser.ts`** - Add function:
- `collectInlineObjectTypes(sourceFile, program)` → array of inline type locations
- Walks AST for `TypeLiteral` nodes
- Checks parent context to exempt generic constraints
- Returns: file path, line/column, context description

**`types.ts`** - Add type:
- `InlineTypeViolation`: `filePath`, `line`, `column`, `context`

**`analyzer.ts`** - Integrate:
- Call `collectInlineObjectTypes` for each file
- Add inline violations to results alongside single-use type violations

**`reporter.ts`** - Update output:
- Report inline violations with context-specific messages

**`suppression.ts`** - No changes needed

## Output Format

### Violation Messages

```
src/api/handler.ts:42:18 - Inline object type in parameter 'options'. Extract to a named type.
src/api/handler.ts:45:3 - Inline object type in return type. Extract to a named type.
src/utils/config.ts:12:14 - Inline object type in variable 'settings'. Extract to a named type.
```

### Context Labels

- `parameter 'paramName'`
- `return type`
- `variable 'varName'`
- `type assertion`
- `generic argument`
- `property 'propName'`
- `destructured parameter`

### Guidance Message

```
Inline object types should be extracted to named types that describe domain concepts.

Instead of:  function process(opts: { timeout: number; retries: number })
Use:         function process(opts: RetryPolicy)
```

## Testing

### Violation Fixtures

```typescript
// parameter
function withParam(opts: { name: string }) {}

// return type
function withReturn(): { success: boolean } { return { success: true }; }

// variable
const config: { timeout: number } = { timeout: 5000 };

// type assertion
const data = response as { id: string };

// generic argument
const map: Map<string, { count: number }> = new Map();

// destructured parameter
function withDestructure({ x }: { x: number }) {}

// nested property
interface Parent { nested: { value: string } }
```

### Valid Fixtures (Not Flagged)

```typescript
// generic constraint - exempted
function withConstraint<T extends { id: string }>(item: T) {}

// named types
interface Options { name: string }
function withNamed(opts: Options) {}
```

### Test Cases

- Each violation type detected
- Generic constraints exempted
- Correct file/line/column
- Context labels accurate
- Suppression works
