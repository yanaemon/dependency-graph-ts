import "./a";

export function functionD() {
	console.log("Function D");
	// This creates a circular dependency: a -> b -> d -> a
}
