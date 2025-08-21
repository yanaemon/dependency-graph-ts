import * as fs from "fs";
import * as path from "path";

export interface DependencyNode {
	id: string;
	name: string;
	fullPath: string;
	imports: string[];
	importedBy: string[];
}

export interface DependencyGraph {
	nodes: Map<string, DependencyNode>;
	edges: Array<{ source: string; target: string; circular?: boolean }>;
}

export interface ParserSettings {
	excludePatterns?: RegExp[];
	rootDir: string;
	extensions?: string[];
}

export class DependencyParser {
	private settings: Required<ParserSettings>;
	private graph: DependencyGraph;

	constructor(settings: ParserSettings) {
		this.settings = {
			...settings,
			excludePatterns: settings.excludePatterns || [],
			extensions: settings.extensions || [".ts", ".tsx", ".js", ".jsx"],
		};
		this.graph = {
			nodes: new Map(),
			edges: [],
		};
	}

	private shouldExclude(filePath: string): boolean {
		return this.settings.excludePatterns.some((pattern) =>
			pattern.test(filePath),
		);
	}

	private extractImports(content: string, filePath: string): string[] {
		const imports: string[] = [];

		// Remove single-line comments
		let cleanContent = content.replace(/\/\/.*$/gm, "");

		// Remove multi-line comments
		cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, "");

		const importRegex =
			/(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
		const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;

		let match;
		while ((match = importRegex.exec(cleanContent)) !== null) {
			const importPath = match[1];
			const resolvedPath = this.resolveImportPath(importPath, filePath);
			if (resolvedPath) {
				imports.push(resolvedPath);
			}
		}

		while ((match = requireRegex.exec(cleanContent)) !== null) {
			const importPath = match[1];
			const resolvedPath = this.resolveImportPath(importPath, filePath);
			if (resolvedPath) {
				imports.push(resolvedPath);
			}
		}

		return [...new Set(imports)];
	}

	private resolveImportPath(
		importPath: string,
		fromFile: string,
	): string | null {
		if (importPath.startsWith(".")) {
			const dir = path.dirname(fromFile);
			const resolved = path.resolve(dir, importPath);

			for (const ext of this.settings.extensions) {
				const withExt = resolved + ext;
				if (fs.existsSync(withExt)) {
					return path.relative(this.settings.rootDir, withExt);
				}
			}

			if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
				return path.relative(this.settings.rootDir, resolved);
			}

			const indexPath = path.join(resolved, "index");
			for (const ext of this.settings.extensions) {
				const withExt = indexPath + ext;
				if (fs.existsSync(withExt)) {
					return path.relative(this.settings.rootDir, withExt);
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
				fullPath: file,
				imports: [],
				importedBy: [],
			};
			this.graph.nodes.set(relativePath, node);
		}

		for (const file of files) {
			const content = fs.readFileSync(file, "utf-8");
			const relativePath = path.relative(this.settings.rootDir, file);
			const imports = this.extractImports(content, file);

			const node = this.graph.nodes.get(relativePath);
			if (node) {
				node.imports = imports.filter((imp) => this.graph.nodes.has(imp));

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
