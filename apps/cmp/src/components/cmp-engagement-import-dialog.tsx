"use client";

import { Button, ButtonGroup, Checkbox } from "@project-wing/ui";
import { useState } from "react";

import { useCmpI18n } from "../i18n/client";
import {
  DEFAULT_ENGAGEMENT_IMPORT_SECTIONS,
  ENGAGEMENT_IMPORT_SECTIONS,
  serializeEngagementImportSections,
} from "./cmp-engagement-import-sections";
import type { EngagementImportSection } from "./cmp-engagement-import-sections";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function CmpEngagementImportDialog({
  open,
  sourceEngagementCode,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  sourceEngagementCode: string | null;
  onConfirm: (importSections: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const [selectedImportSections, setSelectedImportSections] = useState<
    EngagementImportSection[]
  >(DEFAULT_ENGAGEMENT_IMPORT_SECTIONS);

  const importOptions: {
    id: EngagementImportSection;
    title: string;
    description: string;
  }[] = [
    {
      id: "business",
      title: copy.engagementImportBusiness,
      description: copy.engagementImportBusinessDescription,
    },
    {
      id: "reports",
      title: copy.engagementImportReports,
      description: copy.engagementImportReportsDescription,
    },
    {
      id: "risk",
      title: copy.engagementImportRisk,
      description: copy.engagementImportRiskDescription,
    },
    {
      id: "people",
      title: copy.engagementImportPeople,
      description: copy.engagementImportPeopleDescription,
    },
    {
      id: "commercial",
      title: copy.engagementImportCommercial,
      description: copy.engagementImportCommercialDescription,
    },
    {
      id: "notes",
      title: copy.engagementImportNotes,
      description: copy.engagementImportNotesDescription,
    },
  ];

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.engagementImportTitle}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {copy.engagementImportDescription.replace(
              "{engagementCode}",
              sourceEngagementCode ?? ""
            )}
          </p>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 border-y border-border py-3">
          <span className="text-sm text-muted-foreground">
            {copy.engagementImportInactiveStaffHint}
          </span>
          <ButtonGroup>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setSelectedImportSections(DEFAULT_ENGAGEMENT_IMPORT_SECTIONS)
              }
            >
              {copy.engagementImportSelectAll}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedImportSections([])}
            >
              {copy.engagementImportClearAll}
            </Button>
          </ButtonGroup>
        </div>
        <div className="grid gap-2">
          {importOptions.map((option) => {
            const checked = selectedImportSections.includes(option.id);
            return (
              <label
                key={option.id}
                htmlFor={`engagement-import-${option.id}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/45"
              >
                <Checkbox
                  id={`engagement-import-${option.id}`}
                  checked={checked}
                  onCheckedChange={(nextChecked) =>
                    setSelectedImportSections((current) =>
                      nextChecked
                        ? ENGAGEMENT_IMPORT_SECTIONS.filter(
                            (section) =>
                              current.includes(section) || section === option.id
                          )
                        : current.filter((section) => section !== option.id)
                    )
                  }
                />
                <span className="grid gap-0.5">
                  <strong className="text-sm text-foreground">
                    {option.title}
                  </strong>
                  <span className="text-sm text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {copy.close}
          </Button>
          <Button
            type="button"
            onClick={() =>
              onConfirm(
                serializeEngagementImportSections(selectedImportSections)
              )
            }
          >
            {copy.engagementImportConfirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
