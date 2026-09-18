export class DesktopAgentRuntimeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DesktopAgentRuntimeRequestError";
  }
}
