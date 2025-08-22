import * as fs from "node:fs";
import * as path from "node:path";
import * as jsonc from "jsonc-parser";
import * as ts from "typescript";

export interface DependencyNode {
  id: string;
  name: string;
  displayName: string;
  fullPath: string;
  imports: string[];
  importedBy: string[];
  unresolvedImports?: string[];
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Array<{ source: string; target: string; circular?: boolean }>;
}

export interface ParserSettings {
  excludePatterns?: RegExp[];
  includePatterns?: RegExp[];
  rootDir: string;
  extensions?: string[];
  showFullPath?: boolean;
  pathAliases?: Record<string, string[]>; // e.g., { "@/*": ["src/*"] }
}

export class DependencyParser {
  private settings: Required<ParserSettings>;
  private graph: DependencyGraph;

  constructor(settings: ParserSettings) {
    this.settings = {
      ...settings,
      excludePatterns: settings.excludePatterns || [],
      includePatterns: settings.includePatterns || [],
      extensions: settings.extensions || [".ts", ".tsx", ".js", ".jsx"],
      showFullPath:
        settings.showFullPath !== undefined ? settings.showFullPath : true,
      pathAliases:
        settings.pathAliases || this.loadTsConfigPaths(settings.rootDir),
    };
    this.graph = {
      nodes: new Map(),
      edges: [],
    };
  }

  private loadTsConfigPaths(rootDir: string): Record<string, string[]> {
    const tsConfigPath = path.join(rootDir, "tsconfig.json");
    if (fs.existsSync(tsConfigPath)) {
      try {
        const content = fs.readFileSync(tsConfigPath, "utf-8");
        // Use jsonc-parser to handle comments in tsconfig.json
        const tsConfig = jsonc.parseTree(content);

        if (!tsConfig) {
          return {};
        }

        const compilerOptions = jsonc.findNodeAtLocation(tsConfig, [
          "compilerOptions",
        ]);
        const pathsNode = compilerOptions
          ? jsonc.findNodeAtLocation(compilerOptions, ["paths"])
          : null;
        const baseUrlNode = compilerOptions
          ? jsonc.findNodeAtLocation(compilerOptions, ["baseUrl"])
          : null;

        const paths = pathsNode ? jsonc.getNodeValue(pathsNode) : {};
        const baseUrl = baseUrlNode ? jsonc.getNodeValue(baseUrlNode) : ".";

        // Store baseUrl for later use
        this.tsConfigBaseUrl = path.resolve(rootDir, baseUrl);

        // Debug logging (can be enabled with DEBUG env var)
        if (process.env.DEBUG) {
          console.log("Loaded TypeScript config:");
          console.log("  baseUrl:", baseUrl);
          console.log("  paths:", paths);
        }

        return paths;
      } catch (error) {
        console.error("Failed to parse tsconfig.json:", error);
      }
    }
    return {};
  }

  private tsConfigBaseUrl: string = "";

  private shouldExclude(filePath: string): boolean {
    return this.settings.excludePatterns.some((pattern) =>
      pattern.test(filePath),
    );
  }

  private shouldInclude(filePath: string): boolean {
    // If no include patterns specified, include all (that aren't excluded)
    if (this.settings.includePatterns.length === 0) {
      return true;
    }
    // Otherwise, file must match at least one include pattern
    return this.settings.includePatterns.some((pattern) =>
      pattern.test(filePath),
    );
  }

  private extractImports(
    content: string,
    filePath: string,
  ): { resolved: string[]; unresolved: string[] } {
    const resolved: string[] = [];
    const unresolved: string[] = [];
    const allImports = new Set<string>();

    // Create a TypeScript source file from the content
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
    );

    // Walk the AST to find all import/export statements
    const visit = (node: ts.Node) => {
      // Handle import declarations: import ... from '...'
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          allImports.add(node.moduleSpecifier.text);
        }
      }
      // Handle export declarations: export ... from '...'
      else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          allImports.add(node.moduleSpecifier.text);
        }
      }
      // Handle dynamic imports: import('...')
      else if (ts.isCallExpression(node)) {
        if (
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments.length > 0
        ) {
          const arg = node.arguments[0];
          if (ts.isStringLiteral(arg)) {
            allImports.add(arg.text);
          }
        }
        // Handle require statements: require('...')
        else if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === "require" &&
          node.arguments.length > 0
        ) {
          const arg = node.arguments[0];
          if (ts.isStringLiteral(arg)) {
            allImports.add(arg.text);
          }
        }
      }

      // Recursively visit child nodes
      ts.forEachChild(node, visit);
    };

    // Start visiting from the root
    visit(sourceFile);

    for (const importPath of allImports) {
      // Skip node_modules and external packages
      // But keep path aliases (they start with @ or have special prefixes)
      const isPathAlias =
        importPath.startsWith("@") ||
        Object.keys(this.settings.pathAliases).some((alias) => {
          const aliasPrefix = alias.replace(/\/?\*$/, "");
          return (
            importPath === aliasPrefix ||
            importPath.startsWith(`${aliasPrefix}/`)
          );
        });

      if (
        !isPathAlias &&
        !importPath.startsWith(".") &&
        !importPath.startsWith("/") &&
        !importPath.includes("/")
      ) {
        // This is likely an npm package, skip it
        continue;
      }

      const resolvedPath = this.resolveImportPath(importPath, filePath);
      if (resolvedPath) {
        resolved.push(resolvedPath);
      } else {
        unresolved.push(importPath);
      }
    }

    return {
      resolved: [...new Set(resolved)],
      unresolved: [...new Set(unresolved)],
    };
  }

  private resolveImportPath(
    importPath: string,
    fromFile: string,
  ): string | null {
    // Handle relative imports
    if (importPath.startsWith(".")) {
      const dir = path.dirname(fromFile);
      const resolved = path.resolve(dir, importPath);

      // Try with extensions
      for (const ext of this.settings.extensions) {
        const withExt = resolved + ext;
        if (fs.existsSync(withExt)) {
          return path.relative(this.settings.rootDir, withExt);
        }
      }

      // Try without extension if file exists
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return path.relative(this.settings.rootDir, resolved);
      }

      // Try index files
      const indexPath = path.join(resolved, "index");
      for (const ext of this.settings.extensions) {
        const withExt = indexPath + ext;
        if (fs.existsSync(withExt)) {
          return path.relative(this.settings.rootDir, withExt);
        }
      }
    } else {
      // Handle TypeScript path aliases first
      for (const [alias, replacements] of Object.entries(
        this.settings.pathAliases,
      )) {
        let match: RegExpMatchArray | null = null;
        let resolvedPart = "";

        if (alias.includes("*")) {
          // Handle wildcard aliases
          const escapedAlias = alias
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\\\*/g, "(.*)");
          const regex = new RegExp(`^${escapedAlias}$`);
          match = importPath.match(regex);
          if (match) {
            resolvedPart = match[1] || "";
          }
        } else {
          // Handle exact match aliases
          if (importPath === alias) {
            match = ["", ""]; // Dummy match to proceed
            resolvedPart = "";
          }
        }

        if (match) {
          if (process.env.DEBUG) {
            console.log(`Matched alias "${alias}" for import "${importPath}"`);
          }

          for (const replacement of replacements) {
            // Replace * with the captured group (or nothing for exact matches)
            const resolvedAlias = replacement.includes("*")
              ? replacement.replace("*", resolvedPart)
              : replacement;

            // Use baseUrl if available, otherwise use rootDir
            const basePath = this.tsConfigBaseUrl || this.settings.rootDir;
            const aliasPath = path.join(basePath, resolvedAlias);

            if (process.env.DEBUG) {
              console.log(`  Trying resolved path: ${aliasPath}`);
            }

            // Try with extensions
            for (const ext of this.settings.extensions) {
              const withExt = aliasPath + ext;
              if (fs.existsSync(withExt)) {
                const result = path.relative(this.settings.rootDir, withExt);
                if (process.env.DEBUG) {
                  console.log(`  Found: ${result}`);
                }
                return result;
              }
            }

            // Try without extension
            if (fs.existsSync(aliasPath) && fs.statSync(aliasPath).isFile()) {
              const result = path.relative(this.settings.rootDir, aliasPath);
              if (process.env.DEBUG) {
                console.log(`  Found: ${result}`);
              }
              return result;
            }

            // Try index files
            const indexPath = path.join(aliasPath, "index");
            for (const ext of this.settings.extensions) {
              const withExt = indexPath + ext;
              if (fs.existsSync(withExt)) {
                const result = path.relative(this.settings.rootDir, withExt);
                if (process.env.DEBUG) {
                  console.log(`  Found: ${result}`);
                }
                return result;
              }
            }
          }
        }
      }

      // Try baseUrl resolution if available
      if (this.tsConfigBaseUrl) {
        const baseUrlPath = path.join(this.tsConfigBaseUrl, importPath);

        // Try with extensions
        for (const ext of this.settings.extensions) {
          const withExt = baseUrlPath + ext;
          if (fs.existsSync(withExt)) {
            return path.relative(this.settings.rootDir, withExt);
          }
        }

        // Try without extension
        if (fs.existsSync(baseUrlPath) && fs.statSync(baseUrlPath).isFile()) {
          return path.relative(this.settings.rootDir, baseUrlPath);
        }

        // Try index files
        const indexPath = path.join(baseUrlPath, "index");
        for (const ext of this.settings.extensions) {
          const withExt = indexPath + ext;
          if (fs.existsSync(withExt)) {
            return path.relative(this.settings.rootDir, withExt);
          }
        }
      }

      // Handle absolute imports (from project root)
      // Try common patterns like 'src/something'
      const possiblePaths = [
        path.join(this.settings.rootDir, importPath),
        path.join(this.settings.rootDir, "src", importPath),
      ];

      for (const basePath of possiblePaths) {
        // Try with extensions
        for (const ext of this.settings.extensions) {
          const withExt = basePath + ext;
          if (fs.existsSync(withExt)) {
            return path.relative(this.settings.rootDir, withExt);
          }
        }

        // Try without extension
        if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
          return path.relative(this.settings.rootDir, basePath);
        }

        // Try index files
        const indexPath = path.join(basePath, "index");
        for (const ext of this.settings.extensions) {
          const withExt = indexPath + ext;
          if (fs.existsSync(withExt)) {
            return path.relative(this.settings.rootDir, withExt);
          }
        }
      }
    }

    return null;
  }

  private scanDirectory(dir: string): string[] {
    const files: string[] = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === "dist"
        ) {
          continue;
        }
        files.push(...this.scanDirectory(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (this.settings.extensions.includes(ext)) {
          const relativePath = path.relative(this.settings.rootDir, fullPath);
          if (
            !this.shouldExclude(relativePath) &&
            this.shouldInclude(relativePath)
          ) {
            files.push(fullPath);
          }
        }
      }
    }

    return files;
  }

  public parse(): DependencyGraph {
    const files = this.scanDirectory(this.settings.rootDir);

    for (const file of files) {
      const relativePath = path.relative(this.settings.rootDir, file);
      const node: DependencyNode = {
        id: relativePath,
        name: path.basename(file),
        displayName: this.settings.showFullPath
          ? relativePath
          : path.basename(file),
        fullPath: file,
        imports: [],
        importedBy: [],
      };
      this.graph.nodes.set(relativePath, node);
    }

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(this.settings.rootDir, file);
      const { resolved, unresolved } = this.extractImports(content, file);

      const node = this.graph.nodes.get(relativePath);
      if (node) {
        // Filter out imports to excluded files
        node.imports = resolved.filter((imp) => {
          // Check if the import target is excluded
          if (this.shouldExclude(imp)) {
            if (process.env.DEBUG) {
              console.log(
                `Excluding import to ${imp} (matched exclude pattern)`,
              );
            }
            return false;
          }
          // Check if the import target exists in our graph
          return this.graph.nodes.has(imp);
        });

        // Track unresolved imports for debugging
        if (unresolved.length > 0) {
          node.unresolvedImports = unresolved;
          if (process.env.DEBUG) {
            console.log(`Unresolved imports in ${relativePath}:`, unresolved);
          }
        }

        for (const importPath of node.imports) {
          const targetNode = this.graph.nodes.get(importPath);
          if (targetNode) {
            targetNode.importedBy.push(relativePath);
            this.graph.edges.push({
              source: relativePath,
              target: importPath,
            });
          }
        }
      }
    }

    this.detectCircularDependencies();

    return this.graph;
  }

  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularPairs = new Set<string>();

    const dfs = (nodeId: string, path: string[] = []): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = this.graph.nodes.get(nodeId);
      if (node) {
        for (const importId of node.imports) {
          if (!visited.has(importId)) {
            dfs(importId, [...path]);
          } else if (recursionStack.has(importId)) {
            const cycleStart = path.indexOf(importId);
            if (cycleStart !== -1) {
              for (let i = cycleStart; i < path.length; i++) {
                const source = path[i];
                const target =
                  i === path.length - 1 ? path[cycleStart] : path[i + 1];
                const pairKey = `${source}->${target}`;
                circularPairs.add(pairKey);
              }
            }
          }
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
    };

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    for (const edge of this.graph.edges) {
      const pairKey = `${edge.source}->${edge.target}`;
      if (circularPairs.has(pairKey)) {
        edge.circular = true;
      }
    }
  }

  public getSerializableGraph() {
    return {
      nodes: Array.from(this.graph.nodes.values()),
      edges: this.graph.edges,
    };
  }
}
