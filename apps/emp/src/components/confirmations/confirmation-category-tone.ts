export type ConfirmationCategoryToneKey =
  | "financial"
  | "correspondence"
  | "other"
  | "unclassified"
  | "neutral";

export type ConfirmationCategoryTone = {
  key: ConfirmationCategoryToneKey;
  badge: string;
  navigation: string;
};

const TONES: Record<ConfirmationCategoryToneKey, ConfirmationCategoryTone> = {
  financial: {
    key: "financial",
    badge:
      "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    navigation:
      "border-emerald-500/40 bg-emerald-500/5 text-emerald-800 hover:bg-emerald-500/10 dark:text-emerald-200",
  },
  correspondence: {
    key: "correspondence",
    badge:
      "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    navigation:
      "border-amber-500/40 bg-amber-500/5 text-amber-800 hover:bg-amber-500/10 dark:text-amber-200",
  },
  other: {
    key: "other",
    badge:
      "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    navigation:
      "border-violet-500/40 bg-violet-500/5 text-violet-800 hover:bg-violet-500/10 dark:text-violet-200",
  },
  unclassified: {
    key: "unclassified",
    badge: "border-rose-600/70 bg-rose-500/15 text-rose-800 dark:text-rose-200",
    navigation:
      "border-rose-600/70 bg-rose-500/10 text-rose-900 hover:bg-rose-500/20 dark:text-rose-100",
  },
  neutral: {
    key: "neutral",
    badge: "border-border bg-muted text-muted-foreground",
    navigation:
      "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
  },
};
const CATEGORY_KEYS: Record<string, ConfirmationCategoryToneKey> = {
  FINANCIAL: "financial",
  CORRESPONDENCE: "correspondence",
  OTHER: "other",
  UNCLASSIFIED: "unclassified",
  RECYCLE_BIN: "neutral",
};
const TYPE_KEYS: Record<string, ConfirmationCategoryToneKey> = {
  BANK: "financial",
  INTERMEDIARY: "financial",
  BALANCE: "correspondence",
  RELATED_PARTY: "correspondence",
  LAWYER: "other",
  INVENTORY: "other",
  OTHER: "other",
  UNCLASSIFIED: "unclassified",
};

export function getConfirmationCategoryTone(value: string) {
  return TONES[CATEGORY_KEYS[value] ?? "unclassified"];
}

export function getConfirmationTypeTone(value: string) {
  return TONES[TYPE_KEYS[value] ?? "unclassified"];
}
