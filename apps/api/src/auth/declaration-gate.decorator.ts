import { SetMetadata } from "@nestjs/common";

export const SKIP_DECLARATION_GATE_KEY = "skip_declaration_gate";

export const SkipDeclarationGate = () =>
  SetMetadata(SKIP_DECLARATION_GATE_KEY, true);
