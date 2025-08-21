// import "./b";

export function functionC() {
	console.log("Function C");
	// This creates a circular dependency: b -> c -> b
}
