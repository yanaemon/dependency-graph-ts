# TypeScript Dependency Graph Visualization

A powerful tool for visualizing TypeScript/JavaScript project dependencies using D3.js force-directed graphs.

## Features

- 📊 **Interactive D3.js Visualization**: Force-directed graph with draggable nodes
- 🔴 **Circular Dependency Detection**: Highlights circular dependencies in red
- 🎯 **TypeScript Path Alias Support**: Fully supports tsconfig.json path mappings
- 🔍 **Smart Import Resolution**: Handles ES6 imports, dynamic imports, require statements
- ⚙️ **Flexible Configuration**: JSON config file with multiple override options
- 🚫 **Exclude Patterns**: Filter out test files, build directories, etc.
- 📁 **External Directory Analysis**: Analyze projects outside the current directory

## Installation

```bash
npm install
npm run build
```

## Usage

### Basic Usage

```bash
# Start with default configuration
npm run dev

# Analyze a specific directory
npm run dev -- /path/to/project

# Use a custom config file
npm run dev -- myconfig.json

# Both custom config and directory
npm run dev -- myconfig.json /path/to/project
```

### Production Mode

```bash
npm start
```

## Configuration

### config.json

```json
{
  "port": 4000,
  "defaultRootDir": ".",
  "excludePatterns": [
    "node_modules",
    "dist",
    "\\.test\\.",
    "\\.spec\\.",
    "__tests__"
  ],
  "extensions": [".ts", ".tsx", ".js", ".jsx"],
  "showFullPath": true,
  "ui": {
    "nodeRadius": 8,
    "linkDistance": 100,
    "chargeStrength": -300
  }
}
```

### TypeScript Path Aliases

The tool fully supports TypeScript path aliases defined in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@components/*": ["components/*"],
      "@utils/*": ["utils/*"],
      "@/*": ["*"]
    }
  }
}
```

**Important**: Files imported via different paths (alias vs relative) are correctly resolved to the same node. For example:
- `import { foo } from "@/lib/common"` (using alias)
- `import { foo } from "../lib/common"` (using relative path)

Both resolve to the same `src/lib/common.ts` node in the dependency graph.

### Environment Variables

```bash
# Specify config file path
DEPENDENCY_GRAPH_CONFIG=/path/to/config.json npm run dev

# Enable debug output
DEBUG=1 npm run dev
```

## Web Interface

Access the visualization at `http://localhost:4000`

### Features:
- **Click nodes** to see dependencies in the sidebar
- **Drag nodes** to rearrange the graph
- **Toggle full paths** vs filenames
- **Real-time directory analysis** via web UI
- **Circular dependencies** shown in red

## Exclude Patterns

Files matching exclude patterns are completely removed from the graph, including:
1. The files themselves are not shown as nodes
2. Any imports to those files are filtered out
3. Common patterns: test files, build output, node_modules

## Development

```bash
# Development mode with auto-reload
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## Project Structure

```
dependency-graph.ts/
├── src/               # Core functionality
│   ├── parser.ts      # Dependency parser
│   ├── server.ts      # Express server
│   └── config.ts      # Configuration management
├── examples/          # Example TypeScript files
│   ├── tsconfig.json  # TypeScript config for examples
│   └── src/           # Example source files
├── public/            # Frontend assets
│   ├── index.html     # Web interface
│   └── graph.js       # D3.js visualization
├── tsconfig.json      # Main TypeScript configuration
└── config.json        # Default configuration
```

## Architecture

- **Parser** (`src/parser.ts`): Analyzes TypeScript/JavaScript files and builds the dependency graph
- **Server** (`src/server.ts`): Express server providing REST API and static file serving
- **Frontend** (`public/`): D3.js visualization and interactive UI
- **Config** (`src/config.ts`): Configuration management with multiple override sources
- **Examples** (`examples/`): Demonstration files showing various import patterns and circular dependencies

## License

MIT