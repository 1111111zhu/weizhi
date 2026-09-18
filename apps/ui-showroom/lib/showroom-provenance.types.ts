export type ProvenanceStatus = "unreviewed";

export type ProvenanceValue = string | null;

export interface ProvenanceRoot {
  path: string;
  scope?: ProvenanceValue;
  kind?: ProvenanceValue;
  publicImport?: ProvenanceValue;
  publicEntry?: ProvenanceValue;
}

export interface ProvenanceVariant {
  name: string;
  values: string[];
}

export interface ProvenanceLibrary {
  package: string;
  versions: string[];
  sources: string[];
}

export interface ProvenanceImport {
  source: string;
  line: number;
  kind: string;
  specifiers: string[];
  symbols: Record<string, { file: ProvenanceValue; name: string }>;
  resolved: ProvenanceValue;
  workspace: boolean;
  publicImport: ProvenanceValue;
  package: ProvenanceValue;
  versions: string[];
}

export interface ProvenanceUnresolvedImport {
  file: string;
  source: string;
  line: number;
  kind: string;
}

export interface ProvenanceFile {
  file: string;
  scope: ProvenanceValue;
  kind: ProvenanceValue;
  publicImport: ProvenanceValue;
  publicExports: string[];
  exports: string[];
  reexports: { source: string; names: string[] }[];
  imports: ProvenanceImport[];
  variants: ProvenanceVariant[];
  classNameTokens: string[];
  unresolvedImports: ProvenanceUnresolvedImport[];
}

export interface ProvenanceImplementation {
  id: string;
  name: string;
  file: string;
  scope: ProvenanceValue;
  kind: ProvenanceValue;
  publicImport: ProvenanceValue;
  family: string;
  exports: string[];
  variants: ProvenanceVariant[];
  libraries: ProvenanceLibrary[];
  classNameTokens: string[];
  imports: string[];
  consumers: string[];
  public: boolean;
  lifecycle: ProvenanceStatus;
  disposition: ProvenanceStatus;
}

export interface ProvenanceFamily {
  name: string;
  implementations: string[];
  scopes: string[];
  kinds: string[];
  lifecycle: ProvenanceStatus;
  disposition: ProvenanceStatus;
}

export interface ProvenanceConsumer {
  file: string;
  source: string;
  publicImport: ProvenanceValue;
  resolved: ProvenanceValue;
  line: number;
  kind: string;
  specifiers: string[];
  symbols: Record<string, { file: ProvenanceValue; name: string }>;
  broad: boolean;
}

export interface ProvenanceTokenDefinition {
  name: string;
  file: string;
  line: number;
  value: string;
  selector: ProvenanceValue;
  kind: "css-variable";
}

export interface ProvenanceTokenUsage {
  name: string;
  file: string;
  line: number;
  kind: "css-variable" | "css-variable-use";
}

export interface ProvenanceTokenConflict {
  name: string;
  values: string[];
  files: string[];
  evidence: ProvenanceTokenDefinition[];
}

export interface ProvenanceRawValue {
  value: string;
  file: string;
  line: number;
  kind: "css-color" | "source-color";
}

export interface ProvenanceTokens {
  definitions: ProvenanceTokenDefinition[];
  usages: ProvenanceTokenUsage[];
  conflicts: ProvenanceTokenConflict[];
  rawValues: ProvenanceRawValue[];
}

export interface ProvenanceDependency {
  package: string;
  versions: string[];
  sources: string[];
  files: string[];
}

export interface ProvenanceSummary {
  files: number;
  implementationFiles: number;
  implementations: number;
  families: number;
  dependencies: number;
  consumers: number;
  unresolvedImports: number;
  tokenDefinitions: number;
  tokenConflicts: number;
}

export interface ProvenanceInventory {
  schemaVersion: 1;
  sourceRevision: ProvenanceValue;
  lifecycle: ProvenanceStatus;
  disposition: ProvenanceStatus;
  implementationRoots: ProvenanceRoot[];
  consumerRoots: string[];
  tokenRoots: string[];
  manifestPaths: string[];
  files: ProvenanceFile[];
  implementations: ProvenanceImplementation[];
  families: ProvenanceFamily[];
  consumers: ProvenanceConsumer[];
  tokens: ProvenanceTokens;
  dependencies: ProvenanceDependency[];
  unresolvedImports: ProvenanceUnresolvedImport[];
  summary: ProvenanceSummary;
}

export interface ProvenanceQuery {
  scope?: string;
  kind?: string;
  library?: string;
  public?: boolean;
  lifecycle?: ProvenanceStatus;
  disposition?: ProvenanceStatus;
}

export type ReviewSignalKind =
  | "radix-library"
  | "vendored-registry"
  | "custom-raw-style"
  | "token-conflict"
  | "unresolved-import";

export interface ReviewSignal {
  id: string;
  kind: ReviewSignalKind;
  severity: "high" | "medium" | "low";
  title: string;
  count: number;
  implementationIds: string[];
  files: string[];
  evidence: string[];
  lifecycle: ProvenanceStatus;
  disposition: ProvenanceStatus;
  autoAestheticApproval: false;
}

export interface ProvenanceDimensionSummary {
  value: string;
  implementationCount: number;
  publicImplementationCount: number;
}

export interface ProvenanceLibrarySummary extends ProvenanceDimensionSummary {
  versions: string[];
}

export interface FamilySummary {
  name: string;
  implementationIds: string[];
  implementationCount: number;
  publicImplementationCount: number;
  scopes: string[];
  kinds: string[];
  libraries: string[];
  variants: ProvenanceVariant[];
  lifecycle: ProvenanceStatus;
  disposition: ProvenanceStatus;
  reviewSignalKinds: ReviewSignalKind[];
}

export interface ImplementationDetail extends ProvenanceImplementation {
  rawStyleCount: number;
  tokenConflictCount: number;
  reviewSignalKinds: ReviewSignalKind[];
}

export interface FamilyDetail {
  family: FamilySummary;
  implementations: ImplementationDetail[];
  consumerFiles: string[];
}

export interface TokenDefinitionSummary {
  name: string;
  definitionCount: number;
  values: string[];
  files: string[];
  selectors: string[];
}

export interface TokenConflictSummary extends ProvenanceTokenConflict {
  scopes: string[];
  lifecycle: ProvenanceStatus;
  disposition: ProvenanceStatus;
  autoAestheticApproval: false;
}

export interface TokenOverview {
  definitionCount: number;
  usageCount: number;
  conflictCount: number;
  rawValueCount: number;
  definitions: TokenDefinitionSummary[];
  conflicts: TokenConflictSummary[];
  rawValuesByKind: ProvenanceDimensionSummary[];
}

export interface ProvenanceOverview {
  sourceRevision: ProvenanceValue;
  lifecycle: ProvenanceStatus;
  disposition: ProvenanceStatus;
  summary: ProvenanceSummary;
  scopes: ProvenanceDimensionSummary[];
  kinds: ProvenanceDimensionSummary[];
  libraries: ProvenanceLibrarySummary[];
  publicImplementationCount: number;
  familyCount: number;
  tokenOverview: TokenOverview;
  reviewSignalCount: number;
  aestheticApproval: "unreviewed";
}
