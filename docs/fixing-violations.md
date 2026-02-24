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

## When you see: "X is only used by function 'Y'"

This means a named type (interface or type alias) exists but is only referenced by
one function. Ask yourself what's going on:

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
