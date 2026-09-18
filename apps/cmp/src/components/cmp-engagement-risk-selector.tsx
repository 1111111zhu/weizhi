"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EngagementRiskClassification = "NORMAL" | "GREATER_THAN_NORMAL";

export function CmpEngagementRiskSelector({
  amlRiskClassification,
  engagementRiskClassification,
  labels,
  onAmlRiskClassificationChange,
  onEngagementRiskClassificationChange,
}: {
  amlRiskClassification: "HIGH" | "NOT_HIGH";
  engagementRiskClassification: EngagementRiskClassification;
  labels: {
    amlTfRisk: string;
    amlTfRiskHigh: string;
    amlTfRiskNotHigh: string;
    enhancedDueDiligence: string;
    engagementRisk: string;
    engagementRiskNormal: string;
    engagementRiskGreaterThanNormal: string;
    requiredResponsiblePersons: string;
    pic: string;
    mic: string;
    eqReviewer: string;
  };
  onAmlRiskClassificationChange: (value: "HIGH" | "NOT_HIGH") => void;
  onEngagementRiskClassificationChange: (
    value: EngagementRiskClassification
  ) => void;
}) {
  const requiredPeople = (risk: EngagementRiskClassification) =>
    risk === "GREATER_THAN_NORMAL"
      ? [labels.pic, labels.mic, labels.eqReviewer]
      : [labels.pic, labels.mic];
  return (
    <div className="cmp-form-subsection-grid cmp-form-subsection-grid-two cmp-form-span-full items-start">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{labels.amlTfRisk}</span>
        <Select
          value={amlRiskClassification}
          onValueChange={(value) =>
            onAmlRiskClassificationChange(value as "HIGH" | "NOT_HIGH")
          }
        >
          <SelectTrigger aria-label={labels.amlTfRisk} className="w-full">
            <SelectValue>
              {amlRiskClassification === "HIGH"
                ? labels.amlTfRiskHigh
                : labels.amlTfRiskNotHigh}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NOT_HIGH">{labels.amlTfRiskNotHigh}</SelectItem>
            <SelectItem value="HIGH">{labels.amlTfRiskHigh}</SelectItem>
          </SelectContent>
        </Select>
        {amlRiskClassification === "HIGH" ? (
          <output className="text-xs text-destructive">
            {labels.enhancedDueDiligence}
          </output>
        ) : null}
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{labels.engagementRisk}</span>
        <Select
          value={engagementRiskClassification}
          onValueChange={(value) =>
            onEngagementRiskClassificationChange(
              value as EngagementRiskClassification
            )
          }
        >
          <SelectTrigger aria-label={labels.engagementRisk} className="w-full">
            <SelectValue>
              {engagementRiskClassification === "GREATER_THAN_NORMAL"
                ? labels.engagementRiskGreaterThanNormal
                : labels.engagementRiskNormal}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NORMAL">
              {labels.engagementRiskNormal}
            </SelectItem>
            <SelectItem value="GREATER_THAN_NORMAL">
              {labels.engagementRiskGreaterThanNormal}
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {labels.requiredResponsiblePersons}:{" "}
          {requiredPeople(engagementRiskClassification).join(" · ")}
        </span>
      </label>
    </div>
  );
}
