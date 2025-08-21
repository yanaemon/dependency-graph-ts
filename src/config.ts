import * as fs from "node:fs";
import * as path from "node:path";

export interface Config {
	port: number;
	defaultRootDir: string;
	excludePatterns: string[];
	includePatterns: string[];
	extensions: string[];
	showFullPath: boolean;
	ui: {
		nodeRadius: number;
		linkDistance: number;
		chargeStrength: number;
	};
}

const DEFAULT_CONFIG: Config = {
	port: 4000,
	defaultRootDir: process.cwd(),
	excludePatterns: [],
	includePatterns: [],
	extensions: [".ts", ".tsx", ".js", ".jsx"],
	showFullPath: true,
	ui: {
		nodeRadius: 8,
		linkDistance: 100,
		chargeStrength: -300,
	},
};

export function loadConfig(configPath?: string): Config {
	// Priority order:
	// 1. Command line specified config path
	// 2. Environment variable CONFIG_PATH
	// 3. Default ./config.json
	const resolvedConfigPath =
		configPath ||
		process.env.DEPENDENCY_GRAPH_CONFIG ||
		path.join(process.cwd(), "config.json");

	try {
		if (fs.existsSync(resolvedConfigPath)) {
			console.log(`Loading config from: ${resolvedConfigPath}`);
			const configContent = fs.readFileSync(resolvedConfigPath, "utf-8");
			const loadedConfig = JSON.parse(configContent);

			// Merge with defaults to ensure all fields exist
			const config = {
				...DEFAULT_CONFIG,
				...loadedConfig,
				ui: {
					...DEFAULT_CONFIG.ui,
					...(loadedConfig.ui || {}),
				},
			};

			// Resolve relative paths in config
			if (config.defaultRootDir && !path.isAbsolute(config.defaultRootDir)) {
				config.defaultRootDir = path.resolve(
					path.dirname(resolvedConfigPath),
					config.defaultRootDir,
				);
			}

			return config;
		} else {
			console.log(
				`Config file not found at ${resolvedConfigPath}, using defaults`,
			);
			return DEFAULT_CONFIG;
		}
	} catch (error) {
		console.error(`Error loading config from ${resolvedConfigPath}:`, error);
		console.log("Using default configuration");
		return DEFAULT_CONFIG;
	}
}

export function saveConfig(config: Config, configPath?: string): void {
	const resolvedConfigPath =
		configPath ||
		process.env.DEPENDENCY_GRAPH_CONFIG ||
		path.join(process.cwd(), "config.json");

	try {
		fs.writeFileSync(resolvedConfigPath, JSON.stringify(config, null, 2));
		console.log(`Config saved to: ${resolvedConfigPath}`);
	} catch (error) {
		console.error(`Error saving config to ${resolvedConfigPath}:`, error);
	}
}
