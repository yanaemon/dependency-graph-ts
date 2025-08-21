# Examples

This directory contains example TypeScript files to demonstrate the dependency graph visualization tool's capabilities.

## Structure

```
examples/
├── tsconfig.json      # TypeScript configuration for examples
└── src/
    ├── a.ts          # Example with circular dependencies
    ├── b.ts          # Example with path aliases
    ├── c.ts          # Circular dependency with b.ts
    ├── d.ts          # Circular dependency with a.ts
    ├── app.ts        # Main app example with various imports
    ├── circular/     # Clear circular dependency example
    │   ├── README.md
    │   ├── module1.ts
    │   ├── module2.ts
    │   └── module3.ts
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

### Circular Dependencies
Multiple circular dependency examples:
1. **Simple cycle**: a.ts → d.ts → a.ts
2. **Mutual dependency**: b.ts ↔ c.ts  
3. **Chain cycle**: circular/module1.ts → module2.ts → module3.ts → module1.ts

All circular dependencies will be highlighted in RED in the visualization.

## Running the Examples

From the project root:

```bash
# Analyze the examples directory
npm run dev -- ./examples/src

# Or with debug output
DEBUG=1 npm run dev -- ./examples/src
```

The dependency graph will show at `http://localhost:4000`