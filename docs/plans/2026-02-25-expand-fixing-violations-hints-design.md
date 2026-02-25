# Design: Expand fixing-violations.md with LLM guidance

## Problem

A user reported needing to add ~20KB of supplemental guidance to their CLAUDE.md
to get Claude Code to correctly fix violations reported by this linter. The main
failure modes were:

1. Claude Code defaulting to inlining types (converting named types to anonymous
   inline object types), which moves in the wrong direction
2. No prioritized workflow — Claude Code would try complex refactorings before
   checking if the code was unused or the helper could be inlined
3. Fixes that resolved one violation but created new ESLint violations
   (e.g., max-params)
4. Creating types with generic names (`*Params`, `*Options`) instead of
   domain-meaningful names

## Approach

Expand the existing `docs/fixing-violations.md` from ~159 lines to ~250-300
lines. Keep the existing pattern sections (which are already good) and add:

1. An anti-inlining warning in the "Never do these" section
2. A "Working with other linting rules" section about satisfying all rules
   simultaneously
3. A prioritized workflow (DELETE → INLINE HELPER → CONSOLIDATE → OTHER)
4. Type naming guidance
5. External package type checking guidance

Content is generalized from the user's codebase-specific examples to be
universally applicable.

## Detailed changes

### "Never do these" — add one bullet

Add: "Never convert a named type to an inline object type. The fix for a
single-use named type is to restructure code so the type is used in multiple
places or is no longer needed — not to inline it as an anonymous object type."

### New section: "Working with other linting rules"

This linter is often used alongside ESLint rules like `max-params`,
`max-lines-per-function`, and similar structural checks. Fixes must satisfy
all rules simultaneously. The goal is better domain modeling; when a
straightforward fix would break another rule, restructure more deeply.

### New section: "Workflow: fixing single-use type violations"

Prioritized steps:

1. **Delete unused code** — search for imports/call sites; delete if unused.
   An export is only "public" if re-exported from an entry point; internal
   exports with no callers are safe to delete.

2. **Consider inlining the helper** — if single caller, consider inlining.
   May make caller too large temporarily, but can then re-extract at a better
   boundary. Keep if 2+ callers or complex logic. If exported, check whether
   it's truly public API (re-exported from entry point) or just internal.

3. **Consolidate types across boundaries** — shared types via intersection
   (`&`), reuse state types instead of duplicating fields.

4. **Other strategies** — nest subdomains, combine pipelines, unify parallel
   structures, check external packages.

### Existing "When you see" sections

Keep as-is. Add a note that patterns are ordered by the workflow above.

### New section: "Naming types"

Name types after domain concepts, not functions. Avoid generic suffixes like
`*Params`, `*Options`, `*Config`, `*Context`.

### New section: "Check external packages for existing types"

Check `node_modules/[package]/` for `.d.ts` files before creating type stubs.

## Out of scope

- The user's edge-case bug report about pipeline type detection — that's a
  separate linter behavior issue, not a hints file concern
- Changes to linter output or error messages
- Changes to the linter's detection logic
