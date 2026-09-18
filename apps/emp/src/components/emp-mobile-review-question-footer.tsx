"use client";

import { Button, Checkbox, MobileActionSheet } from "@project-wing/ui";
import {
  Check,
  ChevronDown,
  GitBranch,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";

import styles from "./emp-mobile-review-question-footer.module.css";

interface ReviewQuestionFooterCopy {
  referenceWorkpaper: string;
  searchWorkpapers?: string;
  searchMembers?: string;
  noSearchResults?: string;
  assignRespondent: string;
  unassigned: string;
  addReviewNote: string;
  adding: string;
  noWorkpapersAvailable: string;
  close: string;
}

interface ReferenceOption {
  id: string;
  code: string;
  title: string;
  path: string;
}

interface RespondentOption {
  id: string;
  name: string;
  role: string;
}

/** Mobile composition only; draft ownership and creation rules stay with the Q panel. */
export function EmpMobileReviewQuestionFooter({
  copy,
  papers,
  selectedReferenceIds,
  respondents,
  assignedToId,
  pending,
  submitDisabled,
  error,
  onToggleReference,
  onAssign,
  onSubmit,
}: {
  copy: ReviewQuestionFooterCopy;
  papers: ReferenceOption[];
  selectedReferenceIds: string[];
  respondents: RespondentOption[];
  assignedToId: string;
  pending: boolean;
  submitDisabled: boolean;
  error: string | null;
  onToggleReference: (paperId: string) => void;
  onAssign: (userId: string) => void;
  onSubmit: () => void;
}) {
  const [picker, setPicker] = useState<"references" | "respondent" | null>(
    null
  );
  const [paperSearch, setPaperSearch] = useState("");
  const [respondentSearch, setRespondentSearch] = useState("");
  const referenceInputPrefix = useId();
  const assignedRespondent = respondents.find(({ id }) => id === assignedToId);
  const filteredPapers = papers.filter((paper) =>
    [paper.code, paper.title, paper.path]
      .join(" ")
      .toLocaleLowerCase()
      .includes(paperSearch.trim().toLocaleLowerCase())
  );
  const respondentOptions = [
    { id: "", name: copy.unassigned, role: "" },
    ...respondents,
  ].filter((respondent) =>
    [respondent.name, respondent.role]
      .join(" ")
      .toLocaleLowerCase()
      .includes(respondentSearch.trim().toLocaleLowerCase())
  );

  return (
    <div
      className={styles.footer}
      data-emp-mobile-q-create-footer
      data-testid="emp-mobile-q-create-footer"
    >
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.configuration} data-emp-mobile-q-configuration>
        <Button
          type="button"
          variant="secondary"
          className={styles.configurationButton}
          disabled={pending}
          aria-haspopup="dialog"
          aria-expanded={picker === "references"}
          aria-label={copy.referenceWorkpaper}
          onClick={() => setPicker("references")}
        >
          <span className={styles.actionContent}>
            <GitBranch aria-hidden />
            <span className={styles.actionLabel}>
              {copy.referenceWorkpaper}
            </span>
            {selectedReferenceIds.length > 0 ? (
              <span className={styles.count}>
                {selectedReferenceIds.length}
              </span>
            ) : null}
          </span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={styles.configurationButton}
          disabled={pending}
          aria-haspopup="dialog"
          aria-expanded={picker === "respondent"}
          aria-label={`${copy.assignRespondent}: ${assignedRespondent?.name ?? copy.unassigned}`}
          onClick={() => setPicker("respondent")}
        >
          <span className={styles.actionContent}>
            <UserRound aria-hidden />
            <span className={styles.actionLabel}>
              {assignedRespondent?.name ?? copy.unassigned}
            </span>
            <ChevronDown aria-hidden />
          </span>
        </Button>
      </div>
      <Button
        type="button"
        variant="primary"
        fullWidth
        className={styles.submit}
        disabled={submitDisabled}
        loading={pending}
        loadingLabel={copy.adding}
        iconStart={<Send aria-hidden />}
        onClick={onSubmit}
      >
        {copy.addReviewNote}
      </Button>
      <MobileActionSheet
        open={picker === "references"}
        onOpenChange={(open) => {
          if (!open) {
            setPaperSearch("");
            setPicker(null);
          }
        }}
        title={copy.referenceWorkpaper}
        closeLabel={copy.close}
      >
        <div className={styles.search}>
          <Search aria-hidden />
          <Input
            type="search"
            aria-label={copy.searchWorkpapers ?? copy.referenceWorkpaper}
            placeholder={copy.searchWorkpapers ?? copy.referenceWorkpaper}
            value={paperSearch}
            onChange={(event) => setPaperSearch(event.target.value)}
          />
        </div>
        <div className={styles.options} data-emp-mobile-q-reference-options>
          {filteredPapers.length > 0 ? (
            filteredPapers.map((paper) => (
              <label
                key={paper.id}
                className={styles.referenceOption}
                htmlFor={`${referenceInputPrefix}-${paper.id}`}
              >
                <Checkbox
                  id={`${referenceInputPrefix}-${paper.id}`}
                  checked={selectedReferenceIds.includes(paper.id)}
                  disabled={pending}
                  onCheckedChange={() => onToggleReference(paper.id)}
                />
                <span className={styles.optionCopy}>
                  <strong>{paper.code || paper.title}</strong>
                  <span>{paper.path || paper.title}</span>
                </span>
              </label>
            ))
          ) : (
            <p className={styles.empty}>
              {copy.noSearchResults ?? copy.noWorkpapersAvailable}
            </p>
          )}
        </div>
      </MobileActionSheet>
      <MobileActionSheet
        open={picker === "respondent"}
        onOpenChange={(open) => {
          if (!open) {
            setRespondentSearch("");
            setPicker(null);
          }
        }}
        title={copy.assignRespondent}
        closeLabel={copy.close}
      >
        <div className={styles.search}>
          <Search aria-hidden />
          <Input
            type="search"
            aria-label={copy.searchMembers ?? copy.assignRespondent}
            placeholder={copy.searchMembers ?? copy.assignRespondent}
            value={respondentSearch}
            onChange={(event) => setRespondentSearch(event.target.value)}
          />
        </div>
        <div className={styles.options} data-emp-mobile-q-respondent-options>
          {respondentOptions.length > 0 ? (
            respondentOptions.map((respondent) => (
              <Button
                key={respondent.id || "unassigned"}
                type="button"
                variant="quiet"
                className={styles.respondentOption}
                disabled={pending}
                aria-pressed={assignedToId === respondent.id}
                onClick={() => {
                  onAssign(respondent.id);
                  setPicker(null);
                }}
              >
                <span className={styles.actionContent}>
                  <UserRound aria-hidden />
                  <span className={styles.optionCopy}>
                    <strong>{respondent.name}</strong>
                    {respondent.role ? <span>{respondent.role}</span> : null}
                  </span>
                  <Check
                    aria-hidden
                    className={
                      assignedToId === respondent.id
                        ? undefined
                        : styles.unchecked
                    }
                  />
                </span>
              </Button>
            ))
          ) : (
            <p className={styles.empty}>
              {copy.noSearchResults ?? "No matching results"}
            </p>
          )}
        </div>
      </MobileActionSheet>
    </div>
  );
}
