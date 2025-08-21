// Circular dependency example: module1 -> module2 -> module3 -> module1
import { module2Function } from "./module2";

export function module1Function() {
	console.log("Module 1");
	module2Function();
}

export const module1Value = "Module 1 Value";
