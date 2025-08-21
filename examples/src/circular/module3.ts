// Completes the circular dependency: module1 -> module2 -> module3 -> module1
import { module1Value } from "./module1";

export function module3Function() {
	console.log("Module 3");
	console.log("Using:", module1Value); // This creates the circular reference
}

export const module3Value = "Module 3 Value";
