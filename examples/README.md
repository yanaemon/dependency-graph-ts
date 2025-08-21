# Examples

This directory contains example TypeScript files to demonstrate the dependency graph visualization tool's capabilities.

## Structure

```
examples/
├── tsconfig.json      # TypeScript configuration for examples
└── src/
    ├── a.ts          # Example with various imports
    ├── b.ts          # Example with path aliases
    ├── c.ts          # Simple example
    ├── d.ts          # Another example
    ├── app.ts        # Main app example with various imports
    ├── components/   # Example components
    │   └── Button.ts
    ├── lib/          # Example library files
    │   ├── common.ts # Demonstrates alias vs relative imports
    │   └── index.ts
    └── utils/        # Example utilities
        └── helpers.ts
```

## Features Demonstrated

### TypeScript Path Aliases
The examples use various path aliases defined in `tsconfig.json`:
- `@components/*` - Maps to `components/*`
- `@utils/*` - Maps to `utils/*`
- `@lib` - Maps to `lib/index.ts`
- `@/*` - Maps to the src root

### Import Resolution
- Files imported via different paths (alias vs relative) resolve to the same node
- Example: `@/lib/common` and `./lib/common` both resolve to the same file

### Import Patterns
Various import patterns are demonstrated including path aliases, relative imports, and baseUrl resolution.

## Running the Examples

From the project root:

```bash
# Analyze the examples directory
npm run dev -- ./examples/src

# Or with debug output
DEBUG=1 npm run dev -- ./examples/src
```

The dependency graph will show at `http://localhost:4000`