import { functionB } from "./b";
import { functionC } from "./c";
import { functionD } from "./d";

// Test different import patterns
export { functionB } from "./b";
export * from "./c";

export function functionA() {
	console.log("Function A");
	functionB();
	functionC();
	functionD();
}
