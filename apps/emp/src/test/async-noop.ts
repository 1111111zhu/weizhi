/** Successful API fixture for commands that do not return a response payload. */
export function completeWithoutResult(): Promise<void> {
  return Promise.resolve();
}
