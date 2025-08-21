// This file demonstrates path alias resolution.
// It can be imported in multiple ways:
// - "@/lib/common" (using @/* alias from tsconfig paths)
// - "../lib/common" (relative path from example/)
// - "./lib/common" (relative path from src/)
// All imports resolve to the same node in the dependency graph

export function commonFunction() {
	console.log("Common function");
}

export const commonValue = 42;
