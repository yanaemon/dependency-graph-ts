// Test path alias with @lib
import { libFunction } from "@lib";
import { functionC } from "./c";
import { functionD } from "./d";

export function functionB() {
  console.log("Function B");
  functionC();
  functionD();
  libFunction();
}
