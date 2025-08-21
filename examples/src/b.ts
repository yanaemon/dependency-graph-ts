// Test path alias with @lib
import { libFunction } from "@lib";
import { functionC } from "./c";
import { functionD } from "./d";
import { commonValue } from "./lib/common"; // Import using relative path - resolves to same node as @/lib/common

export function functionB() {
	console.log("Function B");
	functionC();
	functionD();
	libFunction();
}
