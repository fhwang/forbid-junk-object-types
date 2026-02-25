# Fixing forbid-junk-object-types violations

These violations are fixable through refactoring. Fixing them often requires changes
beyond the immediate line -- restructuring functions, combining pipeline steps, or
rethinking type hierarchies. This is expected. The linter is asking you to improve
domain modeling, not just move code around.

## Never do these

- Never give up or say the violation is unfixable. It is fixable.
- Never just rename the type (e.g., `Options` -> `Config`). That doesn't fix the problem.
- Never create a wrapper type without domain meaning just to satisfy the linter.
- Never suppress without first trying the refactoring patterns below.
- Never convert a named type to an inline object type. The fix for a single-use
  named type is to restructure code so the type is used in multiple places or is
  no longer needed -- not to inline it as an anonymous object type.

## Working with other linting rules

This linter is often used alongside ESLint rules like `max-params`,
`max-lines-per-function`, and similar structural checks. Fixes must satisfy all
rules simultaneously -- don't fix a junk-object-type violation by creating a new
`max-params` violation (e.g., replacing a parameter object with 10 individual
parameters).

The goal is better domain modeling. When a straightforward fix would break another
rule, that's a signal to restructure more deeply: split the function, share types
across boundaries, or rethink the abstraction.

## Workflow: fixing single-use type violations

When you encounter a single-use type violation, work through these steps in order.
Earlier steps are simpler and more common.

### Step 1: Delete unused code

Check if the function that uses this type is actually called anywhere:
- Search for imports and call sites across the codebase
- If the function is unused, delete it and its types
- Exported-but-never-imported functions are dead code -- delete them
- An export is only "public" if it's re-exported from a package entry point;
  internal exports with no callers are still safe to delete

### Step 2: Consider inlining the helper into its single caller

If the function has exactly one caller, consider inlining the function body.
This eliminates the parameter bundle type naturally. However, inlining may make
the caller too large -- that's OK as a temporary step. Once the logic is back in
the caller, you may find a better boundary for re-extraction that doesn't require
a single-use parameter type.

Keep the helper as-is if it has 2+ callers or contains complex logic worth
isolating. If the function is exported, check whether it's part of the package's
public API (re-exported from an entry point or index file) or just exported for
use within the same package. Internal exports with a single caller can still be
inlined.

### Step 3: Consolidate types across function boundaries

Look for opportunities to share types between related functions:
- If function A calls function B and passes a subset of its parameters, extract
  a shared type for the common parameters
- Use intersection types (`&`) to extend shared types with additional fields
- If multiple functions read/write the same state, reuse the state type instead
  of creating parameter types that duplicate its fields

### Step 4: Other strategies

- Nest types as subdomains when fields have semantic cohesion
- Combine pipeline functions when an intermediate type only connects two functions
- Unify parallel data structures into cohesive domain objects
- Check external packages for existing type definitions before creating stubs

## When you see: "X is only used by function 'Y'"

This means a named type (interface or type alias) exists but is only referenced by
one function. The patterns below correspond to the workflow steps above -- try
deletion and inlining first.

**Can this type be eliminated entirely?**

If the function doesn't need that many parameters, inline them:

```typescript
// BEFORE
interface FetchOptions { url: string; timeout: number; }
function fetchData(opts: FetchOptions) { ... }

// AFTER
function fetchData(url: string, timeout: number) { ... }
```

**Is this type wrapping an intermediate pipeline step?**

If two functions form a pipeline with a type connecting them and only them,
consider combining the functions:

```typescript
// BEFORE
interface RawUserData { ... }
function fetchUser(id: string): RawUserData { ... }
function transformUser(raw: RawUserData): User { ... }

// AFTER
function fetchAndTransformUser(id: string): User {
  // inline both steps
}
```

Keep the intermediate type if: multiple functions consume it, it's exported,
or it represents a meaningful domain concept.

**Is this a private helper with a single caller?**

If a helper function has one caller and minimal logic, inline it. This
eliminates the parameter bundle type naturally:

```typescript
// BEFORE
interface SaveParams { db: Database; record: Record; validate: boolean; }
function saveRecord(params: SaveParams) {
  if (params.validate) check(params.record);
  params.db.save(params.record);
}
function handleSubmit(db: Database, record: Record) {
  saveRecord({ db, record, validate: true }); // only caller
}

// AFTER
function handleSubmit(db: Database, record: Record) {
  check(record);
  db.save(record);
}
```

Keep the helper if: it has 2+ callers, is exported, or contains complex logic.

**Does this type belong nested inside a parent type?**

If the single-use type's fields are a subset of a larger type, nest it
as a subdomain rather than flattening:

```typescript
// BEFORE
interface CollectionSummary { total: number; skipped: number; }
interface BatchMetadata {
  total: number;    // duplicated from CollectionSummary
  skipped: number;  // duplicated from CollectionSummary
  startedAt: Date;
}

// AFTER
interface CollectionSummary { total: number; skipped: number; }
interface BatchMetadata {
  summary: CollectionSummary;  // nested subdomain
  startedAt: Date;
}
```

This works when the fields have semantic cohesion (they represent a distinct
concept within the parent). Don't nest if the grouping is arbitrary.

**Are parallel data structures hiding a unified concept?**

If the type bundles arrays/maps that must stay synchronized, unify them:

```typescript
// BEFORE
interface ProcessingContext {
  orderIds: string[];
  orders: Order[];           // must stay in sync with orderIds
  statuses: Map<string, Status>;
}

// AFTER
interface TrackedOrder {
  orderId: string;
  order: Order;
  status: Status;
}
// Use Map<string, TrackedOrder> instead of ProcessingContext
```

## When you see: "Inline object type in ... Extract to a named type."

This means a function uses an anonymous object type like
`(opts: { timeout: number; retries: number })` instead of a named type.

**Are the parameters part of one domain concept?**

Extract it as a named type that describes the concept:

```typescript
// BEFORE
function fetch(opts: { timeout: number; retries: number; }) { ... }

// AFTER
interface RetryPolicy { timeout: number; retries: number; }
function fetch(opts: RetryPolicy) { ... }
```

**Is this function doing multiple things?**

Look for optional parameters that switch behavior, or redundant parameters.
Split into focused functions instead:

```typescript
// BEFORE
function updateOrder(params: {
  order: Order;
  status: Status;        // redundant -- already in order
  itemId?: string;       // optional -- switches behavior
}) { ... }

// AFTER
function completeOrderItem(order: Order, itemId: string) { ... }
function completeOrder(order: Order) { ... }
```

## Naming types

When extracting or consolidating types, name them after domain concepts -- what
the data represents -- not after the function that uses them.

Good names: `RetryPolicy`, `OrderBatchJob`, `CollectionSummary`
Avoid: `FetchOptions`, `SubmitBatchParams`, `HandleResultConfig`

Generic suffixes like `*Params`, `*Options`, `*Config`, and `*Context` often
indicate the type was created to serve a function rather than to model the domain.
If you can't find a domain-meaningful name, that may signal the type is bundling
unrelated concerns.

## Check external packages for existing types

Before creating custom type definitions for external APIs or SDKs, check if the
package already provides official types. This prevents single-use type violations
and ensures type compatibility.

Where to look:
- Package TypeScript definitions: `node_modules/[package]/` for `.d.ts` files
- Package subdirectories: `resources/`, `lib/`, `types/`
- Import exploration: use IDE autocomplete to discover available types

If you find an existing type, import it directly rather than creating a stub that
duplicates its shape.
