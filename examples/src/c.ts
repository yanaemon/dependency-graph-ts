export function functionC() {
	console.log("Function C");
	// This creates a circular dependency: b -> c -> b
	// Note: In a real app, this would cause issues!
}
