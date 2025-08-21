// Test TypeScript path aliases
import { Button } from "@components/Button";
import { libFunction } from "@lib";
import { formatDate } from "@utils/helpers";

// Test relative imports
import { functionA } from "./a";
import { functionB } from "./b";

export function app() {
  Button();
  formatDate(new Date());
  libFunction();
  functionA();
  functionB();
}
