// Test TypeScript path aliases
import { Button } from "@components/Button";
import { libFunction } from "@lib";
import { formatDate } from "@utils/helpers";

// Test absolute imports (baseUrl)
import { functionA } from "example/a";
import { functionB } from "example/b";

export function app() {
	Button();
	formatDate(new Date());
	libFunction();
	functionA();
	functionB();
}
