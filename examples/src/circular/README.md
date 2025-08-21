# Circular Dependency Example

This directory demonstrates a circular dependency chain that will be highlighted in RED in the dependency graph visualization.

## The Circular Chain

```
module1.ts → module2.ts → module3.ts
     ↑                           ↓
     └───────────────────────────┘
```

- **module1.ts** imports from module2.ts
- **module2.ts** imports from module3.ts  
- **module3.ts** imports from module1.ts (completing the circle)

## Why Circular Dependencies are Problematic

Circular dependencies can cause:
- Initialization order issues
- Difficulty in testing modules in isolation
- Increased coupling between modules
- Potential runtime errors
- Harder to understand code flow

## How to Spot Them

When you run the dependency graph visualization:
1. Look for RED colored edges
2. These indicate circular dependency paths
3. Click on nodes to see their dependencies and find the cycle

## How to Fix Them

Common solutions:
1. **Extract shared code** to a separate module
2. **Use dependency injection** instead of direct imports
3. **Reorganize code** to have clearer hierarchical structure
4. **Use interfaces** to break the dependency cycle