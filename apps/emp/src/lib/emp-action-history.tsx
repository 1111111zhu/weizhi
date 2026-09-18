import { FolderKanban, Truck } from "lucide-react";
import type { ReactNode } from "react";

import type { Dictionary } from "@/i18n/dictionaries";

export type EmpActionHistoryEntry = {
  id: "engagement" | "confirmation-center";
  href: string;
};

const empActionMetadata = {
  engagement: {
    icon: <FolderKanban aria-hidden="true" />,
    label: (dictionary: Dictionary) => dictionary.common.engagement,
  },
  "confirmation-center": {
    icon: <Truck aria-hidden="true" />,
    label: (dictionary: Dictionary) =>
      dictionary.confirmationCenter?.intranet?.shortcut ??
      dictionary.confirmations?.shortcutLabel ??
      "Confirmation",
  },
} satisfies Record<
  EmpActionHistoryEntry["id"],
  { icon: ReactNode; label: (dictionary: Dictionary) => string }
>;

export function getEmpActionIcon(id: EmpActionHistoryEntry["id"]) {
  return empActionMetadata[id].icon;
}

export function getEmpActionLabel(
  id: EmpActionHistoryEntry["id"],
  dictionary: Dictionary
) {
  return empActionMetadata[id].label(dictionary);
}
