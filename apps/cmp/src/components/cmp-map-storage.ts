import type { EntityMap } from "./cmp-map-types";

const storageKey = "cmp-entity-maps-v2";

export function loadMaps(fallback: EntityMap[]) {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? (JSON.parse(value) as EntityMap[]) : fallback;
  } catch {
    return fallback;
  }
}

export function saveMaps(maps: EntityMap[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(maps));
}
