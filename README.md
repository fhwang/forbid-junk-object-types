# forbid-junk-object-types

A TypeScript linter that detects object types and interfaces used by only a single function. This helps identify cases where developers create generic wrapper types that don't describe actual domain concepts, often to work around ESLint's `max-params` rule.

## Problem

Developers sometimes "cheat" parameter count rules by creating single-use types:

```typescript
// Bad: Generic wrapper that doesn't describe the domain
interface ProductDetailsParams {
  product: Product
  user: User
  onNavigate: (path: string) => void
  dispatch: Dispatch<Action>
  dimensions: Dimensions | null
  onAddToCart: AddToCartFn
  subscription: Subscription | null
}

const renderProductDetails = (params: ProductDetailsParams) => { ... }
```

## Solution

This tool:
1. Analyzes TypeScript files using the TypeScript Compiler API
2. Detects object types/interfaces used by only one function
3. Reports violations with actionable domain modeling guidance
4. Supports JSON-based suppression for gradual adoption
5. Integrates into CI/CD pipelines with fast changed-files-only mode

## Installation

```bash
npm install forbid-junk-object-types
# or
pnpm add forbid-junk-object-types
# or
yarn add forbid-junk-object-types
```

## Usage

### Command Line

```bash
# Check all files in current directory
npx forbid-junk-object-types

# Check specific directory
npx forbid-junk-object-types --target-dir ./src

# Check only changed files (for CI)
npx forbid-junk-object-types --changed-only

# Generate suppressions for all violations
npx forbid-junk-object-types --suppress-all

# Check specific files
npx forbid-junk-object-types --files src/foo.ts src/bar.ts
```

### NPM Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "check-types": "forbid-junk-object-types",
    "check-types:changed": "forbid-junk-object-types --changed-only"
  }
}
```

### CLI Options

- `--target-dir <path>` - Directory to analyze (default: current directory)
- `--suppress-all` - Generate suppressions for all violations
- `--changed-only` - Only check files changed vs origin/main (for CI)
- `--files <file...>` - Specific files to check
- `--help, -h` - Show help message

## Suppression Mechanism

Suppressions are stored in `<target-dir>/junk-object-types-suppressions.json`:

```json
{
  "src/apollo/client.ts": {
    "MapsResultSetMergeOptions": {
      "reason": "Apollo Client type policy requires this shape"
    }
  }
}
```

## What Gets Flagged

The tool flags object types/interfaces that:
- Are only used by a single function (in signature or body)
- Are not exported (public API types are allowed)
- Don't extend/implement other types (polymorphism is allowed)
- Don't end with `*Props` (React component props pattern - temporary exception)

## False Positives

The tool automatically allows:
- Exported types (may be used by other modules)
- Types in inheritance hierarchies
- React component props (`*Props` suffix)
- Types used by multiple functions

## CI Integration

### GitHub Actions

```yaml
name: CI
on: [push, pull_request]

jobs:
  junk-object-types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for --changed-only
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Check for junk object types (changed files only)
        run: npx forbid-junk-object-types --changed-only
```

### Other CI Systems

The tool uses standard exit codes:
- `0` - No violations found
- `1` - Violations found
- `2` - Error occurred

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run tests
pnpm test

# Run linter
pnpm run lint
```

## Philosophy

Single-use types often indicate missing domain modeling. Instead of creating generic wrappers like `*Options`, `*Config`, or `*Params`, consider:

1. **Inline the parameters** - If it's truly a one-off, just use individual parameters
2. **Create a domain concept** - Name the type after what it represents in your domain

### Examples

```typescript
// ✗ Generic wrapper
interface SearchOptions {
  query: string
  page: number
}

// ✓ Domain concept
interface SearchQuery {
  query: string
  page: number
}

// ✓ Or inline if truly one-off
function search(query: string, page: number) { ... }
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.
