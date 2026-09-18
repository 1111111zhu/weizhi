/** Fail explicitly when a test fixture or captured invocation is absent. */
export function requiredFixture<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected the test fixture to be present");
  }
  return value;
}
