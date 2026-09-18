export type CmpOwnershipEntity = {
  id: string;
  kind: "COMPANY" | "PARTNERSHIP" | "TRUST" | "OTHER_ORGANISATION" | "PERSON";
};

export type CmpOwnershipObservation = {
  id?: string;
  ownerId: string;
  investeeId: string;
  percentage: number | null;
  effectiveFrom?: string | Date | null;
  effectiveTo?: string | Date | null;
};

export type CmpOwnershipInferenceIssue = {
  code:
    | "TARGET_NOT_COMPANY"
    | "INVALID_OWNERSHIP_OWNER"
    | "INVALID_OWNERSHIP_TARGET"
    | "INVALID_PERCENTAGE"
    | "OVERLAPPING_OBSERVATIONS"
    | "OWNERSHIP_EXCEEDS_100"
    | "NO_CAPACITY_FOR_UNSPECIFIED_EDGE";
  entityId?: string;
  observationIds?: string[];
  message: string;
};

export type CmpOwnershipCandidateStatus = "CONFIRMED" | "EXCLUDED";

export type CmpOwnershipInferenceCandidate = {
  personId: string;
  ownershipPercentage: number;
  status: CmpOwnershipCandidateStatus;
};

export type CmpOwnershipCompanyCoverage = {
  companyId: string;
  recordedPercentage: number;
  unrecordedPercentage: number;
  hasUnspecifiedObservation: boolean;
};

export type CmpOwnershipInferenceResult = {
  status: "OK" | "DATA_CONFLICT" | "INSUFFICIENT_EVIDENCE";
  targetEntityId: string;
  asOf: string;
  thresholdPercentage: number;
  candidates: CmpOwnershipInferenceCandidate[];
  confirmedPercentage: number;
  unconfirmedPercentage: number;
  isComplete: boolean;
  coverage: CmpOwnershipCompanyCoverage[];
  issues: CmpOwnershipInferenceIssue[];
};

export type CmpOwnershipInferenceInput = {
  targetEntityId: string;
  entities: CmpOwnershipEntity[];
  observations: CmpOwnershipObservation[];
  asOf?: string | Date;
  thresholdPercentage?: number;
};

const EPSILON = 1e-9;

function dateValue(value: string | Date | null | undefined, fallback: number) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function activeAt(observation: CmpOwnershipObservation, asOf: number) {
  return (
    dateValue(observation.effectiveFrom, Number.NEGATIVE_INFINITY) <= asOf &&
    dateValue(observation.effectiveTo, Number.POSITIVE_INFINITY) >= asOf
  );
}

function roundPercentage(value: number) {
  return Math.round(Math.max(0, value) * 100_000_000) / 1_000_000;
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index] ?? 0]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row]?.[column] ?? 0) >
        Math.abs(augmented[pivot]?.[column] ?? 0)
      ) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot]?.[column] ?? 0) <= EPSILON) {
      return null;
    }
    [augmented[column], augmented[pivot]] = [
      augmented[pivot] ?? [],
      augmented[column] ?? [],
    ];
    const pivotValue = augmented[column]?.[column] ?? 1;
    for (let index = column; index <= size; index += 1) {
      assertPresentValue(augmented[column])[index] =
        (augmented[column]?.[index] ?? 0) / pivotValue;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }
      const factor = augmented[row]?.[column] ?? 0;
      if (Math.abs(factor) <= EPSILON) {
        continue;
      }
      for (let index = column; index <= size; index += 1) {
        assertPresentValue(augmented[row])[index] =
          (augmented[row]?.[index] ?? 0) -
          factor * (augmented[column]?.[index] ?? 0);
      }
    }
  }
  return augmented.map((row) => row[size] ?? 0);
}

function findStronglyConnectedComponents(edges: number[][]) {
  let nextIndex = 0;
  const indexes = Array.from({ length: edges.length }, () => -1);
  const lowLinks = Array.from({ length: edges.length }, () => -1);
  const stack: number[] = [];
  const inStack = new Set<number>();
  const components: number[][] = [];
  const visit = (node: number) => {
    indexes[node] = nextIndex;
    lowLinks[node] = nextIndex;
    nextIndex += 1;
    stack.push(node);
    inStack.add(node);
    for (const next of edges[node] ?? []) {
      if (indexes[next] === -1) {
        visit(next);
        lowLinks[node] = Math.min(lowLinks[node] ?? 0, lowLinks[next] ?? 0);
      } else if (inStack.has(next)) {
        lowLinks[node] = Math.min(lowLinks[node] ?? 0, indexes[next] ?? 0);
      }
    }
    if (lowLinks[node] !== indexes[node]) {
      return;
    }
    const component: number[] = [];
    while (stack.length > 0) {
      const member = assertPresentValue(stack.pop());
      inStack.delete(member);
      component.push(member);
      if (member === node) {
        break;
      }
    }
    components.push(component);
  };

  for (let node = 0; node < edges.length; node += 1) {
    if (indexes[node] === -1) {
      visit(node);
    }
  }
  return components;
}

function findClosedOwnershipCycles({
  organisationOwners,
  directPersonPercentage,
  unrecordedPercentage,
}: {
  organisationOwners: Map<number, Map<number, number>>;
  directPersonPercentage: number[];
  unrecordedPercentage: number[];
}) {
  const edges = Array.from(
    { length: directPersonPercentage.length },
    (_, index) =>
      [...(organisationOwners.get(index)?.entries() ?? [])]
        .filter(([, percentage]) => percentage > EPSILON)
        .map(([ownerIndex]) => ownerIndex)
  );
  const closed = new Set<number>();
  for (const component of findStronglyConnectedComponents(edges)) {
    const members = new Set(component);
    const hasCycle =
      component.length > 1 ||
      component.some(
        (node) => (organisationOwners.get(node)?.get(node) ?? 0) > EPSILON
      );
    if (!hasCycle) {
      continue;
    }
    const hasAbsorbingExit = component.some(
      (node) =>
        (directPersonPercentage[node] ?? 0) > EPSILON ||
        (unrecordedPercentage[node] ?? 0) > EPSILON ||
        [...(organisationOwners.get(node)?.entries() ?? [])].some(
          ([ownerIndex, percentage]) =>
            percentage > EPSILON && !members.has(ownerIndex)
        )
    );
    if (!hasAbsorbingExit) {
      component.forEach((node) => closed.add(node));
    }
  }
  return closed;
}

function conflictResult({
  input,
  asOf,
  thresholdPercentage,
  coverage,
  issues,
}: {
  input: CmpOwnershipInferenceInput;
  asOf: Date;
  thresholdPercentage: number;
  coverage: CmpOwnershipCompanyCoverage[];
  issues: CmpOwnershipInferenceIssue[];
}): CmpOwnershipInferenceResult {
  return {
    status: "DATA_CONFLICT",
    targetEntityId: input.targetEntityId,
    asOf: asOf.toISOString(),
    thresholdPercentage,
    candidates: [],
    confirmedPercentage: 0,
    unconfirmedPercentage: 0,
    isComplete: false,
    coverage,
    issues,
  };
}

export function inferCmpOwnership(
  input: CmpOwnershipInferenceInput
): CmpOwnershipInferenceResult {
  const asOfDate =
    input.asOf instanceof Date
      ? new Date(input.asOf)
      : input.asOf
        ? new Date(input.asOf)
        : new Date();
  const asOf = Number.isFinite(asOfDate.getTime()) ? asOfDate : new Date();
  const asOfTimestamp = asOf.getTime();
  const thresholdPercentage = input.thresholdPercentage ?? 25;
  const issues: CmpOwnershipInferenceIssue[] = [];
  const entityById = new Map(
    input.entities.map((entity) => [entity.id, entity])
  );
  const target = entityById.get(input.targetEntityId);
  if (!target || target.kind === "PERSON") {
    issues.push({
      code: "TARGET_NOT_COMPANY",
      entityId: input.targetEntityId,
      message: "The ownership inference target must be an organisation.",
    });
  }

  const active = input.observations.filter((observation) =>
    activeAt(observation, asOfTimestamp)
  );
  const observationByPair = new Map<string, CmpOwnershipObservation>();
  for (const observation of active) {
    if (!entityById.has(observation.ownerId)) {
      issues.push({
        code: "INVALID_OWNERSHIP_OWNER",
        entityId: observation.ownerId,
        observationIds: observation.id ? [observation.id] : undefined,
        message: "An ownership relationship must start from a known entity.",
      });
    }
    if (
      !entityById.has(observation.investeeId) ||
      entityById.get(observation.investeeId)?.kind === "PERSON"
    ) {
      issues.push({
        code: "INVALID_OWNERSHIP_TARGET",
        entityId: observation.investeeId,
        observationIds: observation.id ? [observation.id] : undefined,
        message: "An ownership relationship must point to an organisation.",
      });
    }
    if (
      observation.percentage !== null &&
      (!Number.isFinite(observation.percentage) ||
        observation.percentage < 0 ||
        observation.percentage > 100)
    ) {
      issues.push({
        code: "INVALID_PERCENTAGE",
        observationIds: observation.id ? [observation.id] : undefined,
        message: "Ownership percentages must be between 0 and 100.",
      });
    }
    const key = `${observation.ownerId}\u0000${observation.investeeId}`;
    const previous = observationByPair.get(key);
    if (previous) {
      issues.push({
        code: "OVERLAPPING_OBSERVATIONS",
        entityId: observation.investeeId,
        observationIds: [previous.id, observation.id].filter(
          (id): id is string => Boolean(id)
        ),
        message:
          "The same owner and investee have more than one active ownership observation.",
      });
    } else {
      observationByPair.set(key, observation);
    }
  }

  const organisations = input.entities.filter(
    (entity) => entity.kind !== "PERSON"
  );
  const organisationIndex = new Map(
    organisations.map((organisation, index) => [organisation.id, index])
  );
  const recordedByOrganisation = new Map<string, number>();
  const unspecifiedByOrganisation = new Set<string>();
  const organisationOwners = new Map<number, Map<number, number>>();
  const directByPerson = new Map<string, number[]>();
  const directPersonPercentage = Array.from(
    { length: organisations.length },
    () => 0
  );

  for (const observation of active) {
    if (observation.percentage === null) {
      unspecifiedByOrganisation.add(observation.investeeId);
      continue;
    }
    if (observation.percentage < 0 || observation.percentage > 100) {
      continue;
    }
    const investeeIndex = organisationIndex.get(observation.investeeId);
    const owner = entityById.get(observation.ownerId);
    if (investeeIndex === undefined || !owner) {
      continue;
    }
    const fraction = observation.percentage / 100;
    recordedByOrganisation.set(
      observation.investeeId,
      (recordedByOrganisation.get(observation.investeeId) ?? 0) + fraction
    );
    if (owner.kind === "PERSON") {
      directPersonPercentage[investeeIndex] =
        (directPersonPercentage[investeeIndex] ?? 0) + fraction;
      const direct =
        directByPerson.get(owner.id) ??
        Array.from({ length: organisations.length }, () => 0);
      direct[investeeIndex] = (direct[investeeIndex] ?? 0) + fraction;
      directByPerson.set(owner.id, direct);
      continue;
    }
    const ownerIndex = organisationIndex.get(owner.id);
    if (ownerIndex === undefined) {
      continue;
    }
    const owners =
      organisationOwners.get(investeeIndex) ?? new Map<number, number>();
    owners.set(ownerIndex, (owners.get(ownerIndex) ?? 0) + fraction);
    organisationOwners.set(investeeIndex, owners);
  }

  const unrecordedPercentage = organisations.map((organisation) =>
    Math.max(0, 1 - (recordedByOrganisation.get(organisation.id) ?? 0))
  );
  const coverage = organisations.map((organisation, index) => {
    const recorded = recordedByOrganisation.get(organisation.id) ?? 0;
    if (recorded > 1 + EPSILON) {
      issues.push({
        code: "OWNERSHIP_EXCEEDS_100",
        entityId: organisation.id,
        message: "Recorded ownership exceeds 100%.",
      });
    }
    if (
      unspecifiedByOrganisation.has(organisation.id) &&
      (unrecordedPercentage[index] ?? 0) <= EPSILON
    ) {
      issues.push({
        code: "NO_CAPACITY_FOR_UNSPECIFIED_EDGE",
        entityId: organisation.id,
        message:
          "An unspecified ownership relationship has no remaining percentage available.",
      });
    }
    return {
      companyId: organisation.id,
      recordedPercentage: roundPercentage(recorded),
      unrecordedPercentage: roundPercentage(unrecordedPercentage[index] ?? 0),
      hasUnspecifiedObservation: unspecifiedByOrganisation.has(organisation.id),
    };
  });

  if (issues.length > 0) {
    return conflictResult({
      input,
      asOf,
      thresholdPercentage,
      coverage,
      issues,
    });
  }

  const unknownSinkOrganisations = findClosedOwnershipCycles({
    organisationOwners,
    directPersonPercentage,
    unrecordedPercentage,
  });
  const matrix = Array.from({ length: organisations.length }, (_, row) =>
    Array.from({ length: organisations.length }, (columnIndex, column) =>
      row === column ? 1 : 0
    )
  );
  const unknownSinkVector = [...unrecordedPercentage];
  for (
    let investeeIndex = 0;
    investeeIndex < organisations.length;
    investeeIndex += 1
  ) {
    if (unknownSinkOrganisations.has(investeeIndex)) {
      unknownSinkVector[investeeIndex] = 1;
      continue;
    }
    for (const [ownerIndex, fraction] of organisationOwners.get(
      investeeIndex
    ) ?? []) {
      assertPresentValue(matrix[investeeIndex])[ownerIndex] -= fraction;
    }
  }

  const unknownSinkSolution = solveLinearSystem(matrix, unknownSinkVector);
  if (!unknownSinkSolution) {
    throw new Error(
      "Ownership absorption matrix remained singular after cycle collapse."
    );
  }
  const targetIndex = organisationIndex.get(input.targetEntityId);
  const unconfirmedFraction =
    targetIndex === undefined ? 0 : (unknownSinkSolution[targetIndex] ?? 0);
  const candidates = [...directByPerson.entries()]
    .map(([personId, direct]) => {
      const solution = solveLinearSystem(matrix, direct);
      if (!solution) {
        throw new Error(
          "Known ownership matrix remained singular after cycle collapse."
        );
      }
      const ownershipFraction =
        targetIndex === undefined ? 0 : (solution[targetIndex] ?? 0);
      const ownershipPercentage = roundPercentage(ownershipFraction);
      return {
        personId,
        ownershipPercentage,
        status:
          ownershipPercentage + EPSILON >= thresholdPercentage
            ? ("CONFIRMED" as const)
            : ("EXCLUDED" as const),
      };
    })
    .filter((candidate) => candidate.ownershipPercentage > EPSILON)
    .sort(
      (left, right) =>
        right.ownershipPercentage - left.ownershipPercentage ||
        left.personId.localeCompare(right.personId)
    );
  const confirmedPercentage = roundPercentage(
    candidates.reduce(
      (sum, candidate) => sum + candidate.ownershipPercentage / 100,
      0
    )
  );
  const unconfirmedPercentage = roundPercentage(unconfirmedFraction);
  const isComplete = unconfirmedPercentage <= EPSILON;

  return {
    status: isComplete ? "OK" : "INSUFFICIENT_EVIDENCE",
    targetEntityId: input.targetEntityId,
    asOf: asOf.toISOString(),
    thresholdPercentage,
    candidates,
    confirmedPercentage,
    unconfirmedPercentage,
    isComplete,
    coverage,
    issues,
  };
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
