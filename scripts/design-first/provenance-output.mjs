import { existsSync, readFileSync } from "node:fs";

import { deepSort } from "./provenance-utils.mjs";

function validateInventoryShape(inventory, errors) {
  const arrays = [
    "implementations",
    "families",
    "files",
    "dependencies",
    "consumers",
    "unresolvedImports",
  ];
  if (!inventory || typeof inventory !== "object")
    errors.push("inventory must be an object");
  if (inventory?.schemaVersion === undefined)
    errors.push("schemaVersion is required");
  if (inventory?.disposition !== "unreviewed")
    errors.push("generated inventory disposition must be unreviewed");
  if (inventory?.lifecycle !== "unreviewed")
    errors.push("generated inventory lifecycle must be unreviewed");
  for (const field of arrays)
    if (!Array.isArray(inventory?.[field]))
      errors.push(`${field} must be an array`);
  for (const field of ["definitions", "usages", "conflicts", "rawValues"])
    if (!Array.isArray(inventory?.tokens?.[field]))
      errors.push(`tokens.${field} must be an array`);
}

function validateImplementations(inventory, errors) {
  const ids = new Set();
  for (const item of inventory?.implementations ?? []) {
    if (!item.id || ids.has(item.id))
      errors.push(`implementation ids must be unique: ${item.id ?? "missing"}`);
    ids.add(item.id);
    if (item.lifecycle !== "unreviewed")
      errors.push(`implementation ${item.id} lifecycle must be unreviewed`);
    if (["approved", "ready"].includes(String(item.disposition).toLowerCase()))
      errors.push(`implementation ${item.id} has forbidden disposition`);
  }
  return ids;
}

function validateFamilies(inventory, implementationIds, errors) {
  for (const family of inventory?.families ?? []) {
    for (const id of family.implementations ?? [])
      if (!implementationIds.has(id))
        errors.push(
          `family ${family.name} references unknown implementation ${id}`
        );
    if (family.lifecycle !== "unreviewed")
      errors.push(`family ${family.name} lifecycle must be unreviewed`);
    if (
      ["approved", "ready"].includes(String(family.disposition).toLowerCase())
    )
      errors.push(`family ${family.name} has forbidden disposition`);
  }
}

export function validateProvenanceInventory(inventory) {
  const errors = [];
  validateInventoryShape(inventory, errors);
  const implementationIds = validateImplementations(inventory, errors);
  validateFamilies(inventory, implementationIds, errors);
  return {
    valid: errors.length === 0,
    ok: errors.length === 0,
    isValid: errors.length === 0,
    errors,
    warnings: (inventory?.unresolvedImports ?? []).length
      ? [`${inventory.unresolvedImports.length} unresolved workspace imports`]
      : [],
  };
}

export function serializeProvenanceInventory(inventory) {
  const result = validateProvenanceInventory(inventory);
  if (!result.valid)
    throw new Error(
      `Cannot serialize invalid provenance inventory: ${result.errors.join("; ")}`
    );
  return `${JSON.stringify(deepSort(inventory), null, 2)}\n`;
}

export function outputState(outputPath, serialized) {
  if (!existsSync(outputPath))
    return { exists: false, current: false, drift: true };
  const current = readFileSync(outputPath, "utf8") === serialized;
  return { exists: true, current, drift: !current };
}
