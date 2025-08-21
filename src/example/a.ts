import { functionB } from "./b";
import { functionC } from "./c";

export function functionA() {
	console.log("Function A");
	functionB();
	functionC();
}
