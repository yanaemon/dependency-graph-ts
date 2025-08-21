import * as fs from "fs";
import * as path from "path";

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
				const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, "utf-8"));
				const paths = tsConfig.compilerOptions?.paths || {};
				console.log("Loaded TypeScript path aliases:", paths);
				return paths;
			} catch (error) {
				console.error("Failed to parse tsconfig.json:", error);
			}
		}
		return {};
	}

	private shouldExclude(filePath: string): boolean {
		return this.settings.excludePatterns.some((pattern) =>
			pattern.test(filePath),
		);
	}

	private extractImports(
		content: string,
		filePath: string,
	): { resolved: string[]; unresolved: string[] } {
		const resolved: string[] = [];
		const unresolved: string[] = [];

		// Remove single-line comments
		let cleanContent = content.replace(/\/\/.*$/gm, "");

		// Remove multi-line comments
		cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, "");

		// Improved regex patterns to catch more import variations
		const patterns = [
			// Standard ES6 imports: import ... from '...'
			/import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*)?)*\s*from\s+['"]([^'"]+)['"]/g,
			// Export from: export ... from '...'
			/export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g,
			// Dynamic imports: import('...')
			/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
			// Require statements: require('...')
			/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
		];

		const allImports = new Set<string>();

		for (const pattern of patterns) {
			let match;
			while ((match = pattern.exec(cleanContent)) !== null) {
				allImports.add(match[1]);
			}
		}

		for (const importPath of allImports) {
			// Skip node_modules and external packages
			if (
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
				const aliasPattern = alias.replace("*", "(.*)");
				const regex = new RegExp(`^${aliasPattern}$`);
				const match = importPath.match(regex);

				if (match) {
					for (const replacement of replacements) {
						const resolvedAlias = replacement.replace("*", match[1] || "");
						const aliasPath = path.join(this.settings.rootDir, resolvedAlias);

						// Try with extensions
						for (const ext of this.settings.extensions) {
							const withExt = aliasPath + ext;
							if (fs.existsSync(withExt)) {
								return path.relative(this.settings.rootDir, withExt);
							}
						}

						// Try without extension
						if (fs.existsSync(aliasPath) && fs.statSync(aliasPath).isFile()) {
							return path.relative(this.settings.rootDir, aliasPath);
						}

						// Try index files
						const indexPath = path.join(aliasPath, "index");
						for (const ext of this.settings.extensions) {
							const withExt = indexPath + ext;
							if (fs.existsSync(withExt)) {
								return path.relative(this.settings.rootDir, withExt);
							}
						}
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
					if (!this.shouldExclude(relativePath)) {
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
				node.imports = resolved.filter((imp) => this.graph.nodes.has(imp));

				// Track unresolved imports for debugging
				if (unresolved.length > 0) {
					node.unresolvedImports = unresolved;
					console.log(`Unresolved imports in ${relativePath}:`, unresolved);
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
