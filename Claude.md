# Project Information

## Package Manager

This project uses **PNPM** as its package manager.

### Common Commands

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build

# Run linting
pnpm lint
```

### Why PNPM?

PNPM is a fast, disk space efficient package manager that uses a content-addressable store to save disk space and boost installation speed.

## Code Quality

### ESLint

**IMPORTANT: Never suppress ESLint warnings with `eslint-disable` comments.**

If ESLint flags an issue, fix the underlying problem instead of disabling the warning. ESLint rules exist to maintain code quality and consistency. Suppressing warnings hides problems rather than solving them.

If a rule genuinely doesn't apply to this project, configure it in `eslint.config.js` rather than using inline comments.
