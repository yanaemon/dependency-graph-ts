// Part of circular dependency chain: module1 -> module2 -> module3 -> module1
import { module3Function } from "./module3";

export function module2Function() {
	console.log("Module 2");
	module3Function();
}

export const module2Value = "Module 2 Value";
