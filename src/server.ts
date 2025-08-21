import express from "express";
import * as path from "path";
import { type Config, loadConfig } from "./config";
import { DependencyParser } from "./parser";
import "./example/a";

// Load configuration
// Command line args: node server.js [configPath] [rootDir]
const configPath = process.argv[2]?.endsWith(".json")
	? process.argv[2]
	: undefined;
const config: Config = loadConfig(configPath);

// Override with command line root dir if provided
const cliRootDir = process.argv[2]?.endsWith(".json")
	? process.argv[3]
	: process.argv[2];
if (cliRootDir) {
	config.defaultRootDir = cliRootDir;
}

const app = express();
const PORT = config.port;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/config", (req, res) => {
	res.json(config);
});

app.get("/api/graph", (req, res) => {
	try {
		const excludePatterns: RegExp[] = [];

		// Start with config exclude patterns
		config.excludePatterns.forEach((pattern) => {
			try {
				excludePatterns.push(new RegExp(pattern));
			} catch (e) {
				console.error(`Invalid regex pattern in config: ${pattern}`);
			}
		});

		// Add query param exclude patterns
		if (req.query.exclude) {
			const excludes = Array.isArray(req.query.exclude)
				? req.query.exclude
				: [req.query.exclude];
			excludes.forEach((pattern: any) => {
				try {
					excludePatterns.push(new RegExp(pattern));
				} catch (e) {
					console.error(`Invalid regex pattern: ${pattern}`);
				}
			});
		}

		const rootDir = (req.query.rootDir as string) || config.defaultRootDir;
		const showFullPath =
			req.query.showFullPath !== undefined
				? req.query.showFullPath === "true"
				: config.showFullPath;

		// Resolve the path - handles both absolute and relative paths
		const resolvedRootDir = path.isAbsolute(rootDir)
			? rootDir
			: path.resolve(process.cwd(), rootDir);

		// Check if directory exists
		const fs = require("fs");
		if (!fs.existsSync(resolvedRootDir)) {
			return res
				.status(400)
				.json({ error: `Directory not found: ${resolvedRootDir}` });
		}

		if (!fs.statSync(resolvedRootDir).isDirectory()) {
			return res
				.status(400)
				.json({ error: `Path is not a directory: ${resolvedRootDir}` });
		}

		console.log(`Analyzing directory: ${resolvedRootDir}`);

		const parser = new DependencyParser({
			rootDir: resolvedRootDir,
			excludePatterns,
			extensions: config.extensions,
			showFullPath,
		});

		const graph = parser.parse();
		const result = parser.getSerializableGraph();
		console.log(
			`Found ${result.nodes.length} files and ${result.edges.length} dependencies`,
		);
		res.json(result);
	} catch (error) {
		console.error("Error parsing dependencies:", error);
		res.status(500).json({ error: "Failed to parse dependencies" });
	}
});

app.listen(PORT, () => {
	console.log(`Dependency graph server running at http://localhost:${PORT}`);
	console.log(`Default directory: ${config.defaultRootDir}`);
	console.log(`Config loaded from: ${configPath || "default config.json"}`);
	console.log(`\nUsage options:`);
	console.log(
		`  npm run dev                                  # Use default config`,
	);
	console.log(
		`  npm run dev -- /path/to/analyze              # Specify directory`,
	);
	console.log(
		`  npm run dev -- config.json                   # Use specific config`,
	);
	console.log(
		`  npm run dev -- myconfig.json /path/to/dir    # Both config and directory`,
	);
	console.log(`\nEnvironment variables:`);
	console.log(
		`  DEPENDENCY_GRAPH_CONFIG=/path/to/config.json # Config file path`,
	);
});
