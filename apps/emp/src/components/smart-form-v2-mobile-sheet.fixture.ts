import { DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE } from "@project-wing/shared";
import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2LocalizedRichText,
  SmartFormV2SheetNode,
} from "@project-wing/shared";

import { mobileStructureFixtureCopy } from "@/i18n/dictionaries";

export function mobileFixtureText(text: string): SmartFormV2LocalizedRichText {
  return {
    values: {
      "zh-CN": {
        type: "doc",
        version: 1,
        content: [
          { type: "paragraph", id: "text", content: [{ type: "text", text }] },
        ],
      },
    },
  };
}

// Deliberately unrelated to audit-programme identifiers: exercises column groups,
// numeric/date/multiselect fields and explicit comparison-table presentation.
export const MOBILE_STRUCTURE_SHEET: SmartFormV2SheetNode = {
  kind: "sheet",
  id: "stock-observation",
  title: mobileFixtureText(mobileStructureFixtureCopy.title),
  presentation: { density: "compact", width: "full", responsive: "cards" },
  columns: [
    {
      kind: "column",
      id: "subject",
      header: mobileFixtureText(mobileStructureFixtureCopy.subject),
      cell: { kind: "rowLabel" },
    },
    {
      kind: "columnGroup",
      id: "observed",
      header: mobileFixtureText(mobileStructureFixtureCopy.observed),
      children: [
        {
          kind: "column",
          id: "actual",
          header: mobileFixtureText(mobileStructureFixtureCopy.quantity),
          cell: {
            kind: "field",
            field: {
              value: { type: "number" },
              required: true,
            },
          },
        },
      ],
    },
    {
      kind: "columnGroup",
      id: "recorded",
      header: mobileFixtureText(mobileStructureFixtureCopy.recorded),
      children: [
        {
          kind: "column",
          id: "ledger",
          header: mobileFixtureText(mobileStructureFixtureCopy.quantity),
          cell: {
            kind: "field",
            field: {
              value: { type: "number" },
            },
          },
        },
      ],
    },
    {
      kind: "column",
      id: "when",
      header: mobileFixtureText(mobileStructureFixtureCopy.date),
      cell: {
        kind: "field",
        field: {
          value: { type: "date", precision: "day" },
        },
      },
    },
    {
      kind: "column",
      id: "condition",
      header: mobileFixtureText(mobileStructureFixtureCopy.conditions),
      cell: {
        kind: "field",
        field: {
          value: {
            type: "choice",
            cardinality: "many",
            options: [
              {
                id: "damage",
                value: "damage",
                label: mobileFixtureText(mobileStructureFixtureCopy.damaged),
              },
              {
                id: "slow",
                value: "slow",
                label: mobileFixtureText(mobileStructureFixtureCopy.slow),
              },
            ],
          },
        },
      },
    },
    {
      kind: "column",
      id: "narrative",
      header: mobileFixtureText(mobileStructureFixtureCopy.notes),
      cell: {
        kind: "field",
        field: {
          value: { type: "text", multiline: true },
        },
      },
    },
  ],
  rows: {
    mode: "fixed",
    items: [
      {
        id: "area-a",
        role: "group",
        label: mobileFixtureText(mobileStructureFixtureCopy.area),
        children: [
          {
            id: "shelf-a",
            label: mobileFixtureText(mobileStructureFixtureCopy.shelfA),
            cells: {
              narrative: {
                kind: "content",
                content: mobileFixtureText(mobileStructureFixtureCopy.evidence),
              },
              when: {
                kind: "field",
                visibleWhen: { op: "literal", value: false },
              },
            },
          },
          {
            id: "shelf-b",
            label: mobileFixtureText(mobileStructureFixtureCopy.shelfB),
            cells: {
              ledger: { kind: "empty" },
              actual: { kind: "field", required: false },
            },
          },
        ],
      },
    ],
  },
};

export const MOBILE_STRUCTURE_DEFINITION: SmartFormV2CompiledDefinition = {
  ...DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  id: "mobile-structure-reference",
  title: mobileFixtureText(mobileStructureFixtureCopy.referenceTitle),
  description: undefined,
  children: [
    MOBILE_STRUCTURE_SHEET,
    {
      ...MOBILE_STRUCTURE_SHEET,
      id: "stock-comparison",
      title: mobileFixtureText(mobileStructureFixtureCopy.comparison),
      presentation: {
        ...MOBILE_STRUCTURE_SHEET.presentation,
        responsive: "scroll",
      },
    },
  ],
};
