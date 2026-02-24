# Fixing forbid-junk-object-types violations

## Key mindset

These violations are usually fixable through refactoring. Fixing them often requires
changes beyond the immediate line -- restructuring functions, combining pipeline steps,
or rethinking type hierarchies. This is intentional. The linter is asking you to improve
domain modeling, not just rename types.

Before resorting to suppression, try the refactoring patterns below. Suppression is
appropriate when the type genuinely represents good domain modeling that the linter
can't recognize.

## Before you start

1. **First check:** Is this type used in multiple places? Look for:
   - Other function signatures
   - Related types/interfaces that bundle the same fields
   - Downstream functions that receive the same data

2. **Refactoring strategy:**
   - If the same fields appear separately elsewhere, bundle them together
   - Look for "unpack then repack" patterns - opportunities to pass through
   - Example: If function A receives `{id, config}` and passes to function B
     that expects `{id, config}` separately, bundle them in both places

3. **Max-params constraint:**
   - ESLint max-params is set to 3
   - Parameter bundles are legitimate when they represent domain concepts
   - Look for natural groupings: "experiment spec", "request context", etc.

4. **Avoid:** Creating types just to satisfy the linter without domain meaning

## Pattern: Eliminating Intermediate Types in Pipelines

When the linter reports single-use types that represent intermediate pipeline states:

1. **Identify if the intermediate state is necessary:**
   - Is the type used in multiple places? (stored, passed around, operated on)
   - Do other functions need to work with this intermediate state?
   - Is it exported in a public API for external use?

2. **If the intermediate state is NOT necessary:**
   - Consider combining the transformation steps
   - Inline the transformation logic directly where needed
   - This eliminates the intermediate type naturally

3. **Example transformation:**
   ```typescript
   // BEFORE: Two-step pipeline with intermediate type
   interface IntermediateType { ... }
   function step1(input: Input): IntermediateType { ... }
   function step2(intermediate: IntermediateType): Output { ... }

   const intermediate = step1(input);
   const output = step2(intermediate);

   // AFTER: Combined transformation
   function transform(input: Input): Output {
     // Inline logic from both step1 and step2
     ...
   }

   const output = transform(input);
   ```

4. **When to keep the intermediate type:**
   - Multiple functions operate on the intermediate state
   - The intermediate state represents a meaningful domain concept
   - External consumers depend on the type (public API)
   - The separation provides important architectural clarity

## Pattern: Inline Object Types Often Indicate Missing Domain Modeling

When the linter reports inline object types, ask yourself:

1. **Are these parameters all part of one domain concept?**
   - If yes -> Extract that domain concept as a named type
   - If no -> You may be conflating multiple operations

2. **Is this function doing multiple things?**
   - Look for optional parameters that enable different behaviors
   - Look for redundant parameters (e.g., passing both an object and values from that object)
   - Consider splitting into focused functions

3. **Example pattern to watch for:**
   ```typescript
   // BEFORE: Inline object type with conflated operations
   function update(params: {
     container: Container;    // Has .status field
     status: Status;          // Redundant! Already in container
     itemId?: string;         // Optional - enables different operation
   }) {
     container.status = status;  // Mutation indicates redundancy
     if (itemId) { /* different operation */ }
   }

   // AFTER: Separate functions with clear domain types
   function markItemComplete(container: Container, itemId: string) { ... }
   function markContainerComplete(container: Container) { ... }
   ```

4. **Questions to ask:**
   - Is there a "missing middle" type? (e.g., `IndividualBatch` within `BatchMetadata`)
   - Are optional parameters switching between different operations?
   - Am I passing both a container and values from that container?

## Pattern: Nesting Single-Use Types as Subdomains

When the linter flags a "single-use type" that contains fields from a parent type, consider **nesting it as a subdomain** rather than eliminating it. This works when:

1. **The fields logically belong together (semantic cohesion)**
   - They represent a distinct phase or concept within the parent
   - Multiple consumers would benefit from accessing them as a group

2. **Benefits of nesting:**
   - Makes the type a proper domain concept (no longer "single-use")
   - Groups related fields together semantically
   - Avoids max-params violations in functions that create the parent
   - Clear hierarchical relationship in the type structure

3. **Example transformation:**
   ```typescript
   // BEFORE: Flat structure with single-use type
   interface Summary { totalRequests: number; customIdMap: Record<...>; }
   interface Metadata {
     totalRequests: number;      // Duplicates Summary fields
     customIdMap: Record<...>;   // Duplicates Summary fields
     ...other fields
   }
   function create(summary: Summary): Metadata {
     return { totalRequests: summary.totalRequests, customIdMap: summary.customIdMap, ... };
   }

   // AFTER: Nested structure
   interface Summary { totalRequests: number; customIdMap: Record<...>; }
   interface Metadata {
     summary: Summary;           // Nest as subdomain
     ...other fields
   }
   function create(summary: Summary): Metadata {
     return { summary, ... };
   }
   ```

4. **When NOT to nest:**
   - Fields don't have semantic cohesion
   - Only one consumer ever needs these fields together
   - The "parent" type doesn't actually own these concepts

## Pattern: Eliminating Private Helper Functions with Single-Use Types

When the linter flags a "single-use type" that's only used by a private helper function:

1. **Check if the helper is worth keeping:**
   - Does the helper have multiple callers? -> Keep it
   - Is the helper exported/public API? -> Keep it
   - Does the helper provide significant abstraction? -> Keep it
   - Single caller + minimal logic? -> Inline it

2. **Benefits of inlining:**
   - Eliminates the parameter bundle type naturally
   - Reduces indirection (call site shows actual operations)
   - Avoids creating types just to satisfy max-params

3. **Example transformation:**
   ```typescript
   // BEFORE: Private helper with single-use type
   interface HelperParams { a: string; b: number; c: boolean; }
   function helper(params: HelperParams) {
     doThing(params.a, params.b);
     if (params.c) doOtherThing();
   }

   function caller() {
     helper({ a: "x", b: 1, c: true }); // Only caller
   }

   // AFTER: Inline the helper
   function caller() {
     doThing("x", 1);
     if (true) doOtherThing();
   }
   ```

4. **When NOT to inline:**
   - Helper has 2+ callers (legitimate abstraction)
   - Helper is exported for external use
   - Logic is complex enough to deserve isolation
   - Helper is used in tests separately

## Pattern: Parallel Arrays/Maps Indicate Fragmented Domain Modeling

When you encounter single-use context types that bundle multiple parallel data structures, this often signals a **parallel arrays antipattern**:

1. **Recognition signals:**
   - Arrays/Maps that must stay synchronized: `ids: string[]`, `items: Item[]`, `states: Map<string, State>`
   - Index-based coordination loops: `for (let i = 0; i < ids.length; i++)` with `items[i]` and `states.get(ids[i])`
   - Context types bundling these structures: `{ ids, items, states, metadata, db }`
   - Multiple mutation functions that update separate structures in lockstep

2. **Why this creates single-use types:**
   - The context type exists solely to coordinate parallel structures
   - No meaningful domain concept - just "everything needed to process X"
   - Gets passed through multiple functions unchanged
   - Linter correctly identifies as single-use

3. **Solution: Unify into a single structure:**
   ```typescript
   // BEFORE: Parallel structures + context type
   interface ProcessingContext {
     batchIds: string[];          // Array index alignment required
     batches: MessageBatch[];     // Array index alignment required
     states: Map<string, State>;  // Separate lookup required
     metadata: Metadata;
     db: Database;
   }

   for (let i = 0; i < batchIds.length; i++) {
     const id = batchIds[i];
     const batch = batches[i];         // Must stay in sync!
     const state = states.get(id);     // Separate lookup
     // Process with triple coordination
   }

   // AFTER: Unified structure
   interface ProcessableBatch {
     batchId: string;
     batch: MessageBatch;
     state: State;
     displayPosition: number;  // Preserve any array-order semantics
   }

   const batches = Map<string, ProcessableBatch>;

   for (const batch of batches.values()) {
     // Everything available on batch object - no coordination needed
   }
   ```

4. **When NOT to unify:**
   - Structures genuinely represent different concepts (not just split state)
   - External API requires parallel arrays (convert at boundary)
   - Performance-critical code where structure layout matters
