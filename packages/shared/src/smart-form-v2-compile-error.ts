export type SmartFormV2CompileErrorCode =
  | "INVALID_AUTHORED_DEFINITION"
  | "DUPLICATE_COMPONENT_DEFINITION"
  | "INVALID_COMPONENT_DEFINITION"
  | "COMPONENT_NOT_REGISTERED"
  | "COMPONENT_DIGEST_MISMATCH"
  | "INVALID_COMPONENT_PROPS"
  | "COMPONENT_COMPILE_FAILED"
  | "INVALID_COMPONENT_OUTPUT"
  | "COMPONENT_EXPANSION_CYCLE"
  | "COMPONENT_EXPANSION_DEPTH_EXCEEDED"
  | "INVALID_COMPILED_DEFINITION";

export class SmartFormV2CompileError extends Error {
  constructor(
    public readonly code: SmartFormV2CompileErrorCode,
    message: string,
    public readonly path: readonly (string | number)[] = [],
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "SmartFormV2CompileError";
  }
}
