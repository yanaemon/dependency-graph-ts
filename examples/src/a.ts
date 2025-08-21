// Test path aliases
import { Button } from "@components/Button";
import { formatDate } from "@utils/helpers";
import { commonFunction } from "@/lib/common"; // Import using @/ alias - resolves to same node as ./lib/common
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
	Button();
	formatDate(new Date());
}
