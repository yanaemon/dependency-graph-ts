export function functionD() {
  console.log("Function D");
  // This creates a circular dependency: a -> d -> a
  // Note: calling functionA() here would cause infinite recursion!
}
