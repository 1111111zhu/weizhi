import type { CmpAmlLatestResponse } from "@project-wing/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { CmpI18nProvider } from "../i18n/client";
import { CmpAmlScreeningSection } from "./cmp-aml-screening-section";

describe(CmpAmlScreeningSection, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves the draft before running and remains explicitly optional", async () => {
    const ensureDraft = vi.fn().mockResolvedValue("acceptance-1");
    vi.spyOn(api, "cmpAmlLatest").mockResolvedValue(
      latestResponse({ batch: null })
    );
    const runScreening = vi
      .spyOn(api, "runCmpAmlScreening")
      .mockResolvedValue(latestResponse());

    renderSection({ onEnsureDraft: ensureDraft });

    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(
      screen.getByText(/never block submission or approval/i)
    ).toBeInTheDocument();
    await screen.findByText("Example Limited");
    fireEvent.click(
      await screen.findByRole("button", { name: "Screen selected (1)" })
    );

    await waitFor(() => expect(ensureDraft).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(runScreening).toHaveBeenCalledWith("acceptance-1", {
        force: false,
        subjectKeys: ["ROOT"],
      })
    );
  });

  it("shows stale and read-only warnings and confirms a paid rerun", async () => {
    vi.spyOn(api, "cmpAmlLatest").mockResolvedValue(
      latestResponse({ isStale: true, canReviewHits: false, withHit: true })
    );
    const runScreening = vi
      .spyOn(api, "runCmpAmlScreening")
      .mockResolvedValue(latestResponse({ withHit: true }));

    renderSection({
      acceptanceId: "acceptance-1",
      onEnsureDraft: vi.fn().mockResolvedValue("acceptance-1"),
    });

    await expect(
      screen.findByText(/Subject data has changed/i)
    ).resolves.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1 View hits" }));
    expect(screen.getByText(/Only Manager and above/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save review" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run again" }));
    await expect(
      screen.findByText(/may incur charges/i)
    ).resolves.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue rerun" }));
    await waitFor(() =>
      expect(runScreening).toHaveBeenCalledWith("acceptance-1", {
        force: true,
        subjectKeys: ["ROOT"],
      })
    );
  });

  it("lets a reviewer update a hit through the server endpoint", async () => {
    const response = latestResponse({ canReviewHits: true, withHit: true });
    vi.spyOn(api, "cmpAmlLatest").mockResolvedValue(response);
    const review = vi
      .spyOn(api, "reviewCmpAmlHit")
      .mockResolvedValue(response.batch?.subjects[0]?.hits[0] as never);

    renderSection({
      acceptanceId: "acceptance-1",
      onEnsureDraft: vi.fn().mockResolvedValue("acceptance-1"),
    });

    fireEvent.click(await screen.findByRole("button", { name: "1 View hits" }));
    const save = await screen.findByRole("button", { name: "Save review" });
    fireEvent.click(screen.getByRole("combobox", { name: "Review status" }));
    const falsePositive = await screen.findByRole("option", {
      name: "False Positive",
    });
    fireEvent.keyDown(falsePositive, { key: "Enter" });
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Review status" })
      ).toHaveTextContent("False Positive")
    );
    fireEvent.change(screen.getByLabelText("Review comment (optional)"), {
      target: { value: "cleared by reviewer" },
    });
    fireEvent.click(save);

    await waitFor(() =>
      expect(review).toHaveBeenCalledWith("screening-1", "hit-1", {
        reviewStatus: "FALSE_POSITIVE",
        comment: "cleared by reviewer",
      })
    );
  });

  it("filters candidates, selects visible subjects and confirms a changed scope", async () => {
    const response = latestResponse();
    vi.spyOn(api, "cmpAmlLatest").mockResolvedValue(response);
    const runScreening = vi
      .spyOn(api, "runCmpAmlScreening")
      .mockResolvedValue(response);

    renderSection({
      acceptanceId: "acceptance-1",
      onEnsureDraft: vi.fn().mockResolvedValue("acceptance-1"),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Person" }));
    expect(screen.getByText("Alex Owner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select visible" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Screen selected (2)" })
    );
    await screen.findByText(/Changing the subject scope/i);
    fireEvent.click(screen.getByRole("button", { name: "Continue screening" }));

    await waitFor(() =>
      expect(runScreening).toHaveBeenCalledWith("acceptance-1", {
        force: false,
        subjectKeys: ["PERSON:DRAFT:owner", "ROOT"],
      })
    );
  });

  it("saves again when a user returns to the AML step", async () => {
    const ensureDraft = vi.fn().mockResolvedValue("acceptance-1");
    vi.spyOn(api, "cmpAmlLatest").mockResolvedValue(latestResponse());
    const { rerender } = render(
      <CmpI18nProvider initialLocale="en-US">
        <CmpAmlScreeningSection
          acceptanceId="acceptance-1"
          active={false}
          onEnsureDraft={ensureDraft}
        />
      </CmpI18nProvider>
    );

    rerender(
      <CmpI18nProvider initialLocale="en-US">
        <CmpAmlScreeningSection
          acceptanceId="acceptance-1"
          active
          onEnsureDraft={ensureDraft}
        />
      </CmpI18nProvider>
    );
    await waitFor(() => expect(ensureDraft).toHaveBeenCalledOnce());

    rerender(
      <CmpI18nProvider initialLocale="en-US">
        <CmpAmlScreeningSection
          acceptanceId="acceptance-1"
          active={false}
          onEnsureDraft={ensureDraft}
        />
      </CmpI18nProvider>
    );
    rerender(
      <CmpI18nProvider initialLocale="en-US">
        <CmpAmlScreeningSection
          acceptanceId="acceptance-1"
          active
          onEnsureDraft={ensureDraft}
        />
      </CmpI18nProvider>
    );
    await waitFor(() => expect(ensureDraft).toHaveBeenCalledTimes(2));
  });

  it("keeps the latest saved results visible when saving current changes fails", async () => {
    const ensureDraft = vi.fn().mockResolvedValue(null);
    const loadLatest = vi
      .spyOn(api, "cmpAmlLatest")
      .mockResolvedValue(latestResponse());

    renderSection({
      acceptanceId: "acceptance-1",
      onEnsureDraft: ensureDraft,
    });

    await expect(
      screen.findByText("Example Limited")
    ).resolves.toBeInTheDocument();
    expect(loadLatest).toHaveBeenCalledWith("acceptance-1");
    expect(
      screen.getByText(/showing the latest saved AML screening results/i)
    ).toBeInTheDocument();
  });

  it("loads results after draft saving triggers a parent rerender", async () => {
    let resolveDraft: (id: string) => void = () => {};
    const firstEnsureDraft = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveDraft = resolve;
        })
    );
    const loadLatest = vi
      .spyOn(api, "cmpAmlLatest")
      .mockResolvedValue(latestResponse());
    const { rerender } = renderSection({
      acceptanceId: "acceptance-1",
      onEnsureDraft: firstEnsureDraft,
    });

    rerender(
      <CmpI18nProvider initialLocale="en-US">
        <CmpAmlScreeningSection
          acceptanceId="acceptance-1"
          onEnsureDraft={vi.fn().mockResolvedValue("acceptance-1")}
        />
      </CmpI18nProvider>
    );
    resolveDraft("acceptance-1");

    await waitFor(() =>
      expect(loadLatest).toHaveBeenCalledWith("acceptance-1")
    );
    expect(screen.getByText("Example Limited")).toBeInTheDocument();
  });

  it("loads the latest saved results before an existing draft finishes autosaving", async () => {
    const ensureDraft = vi.fn(() => new Promise<string>(() => {}));
    const loadLatest = vi
      .spyOn(api, "cmpAmlLatest")
      .mockResolvedValue(latestResponse());

    renderSection({
      acceptanceId: "acceptance-1",
      onEnsureDraft: ensureDraft,
    });

    await waitFor(() =>
      expect(loadLatest).toHaveBeenCalledWith("acceptance-1")
    );
    expect(screen.getByText("Example Limited")).toBeInTheDocument();
  });
});

function renderSection({
  acceptanceId,
  onEnsureDraft,
}: {
  acceptanceId?: string;
  onEnsureDraft: () => Promise<string | null>;
}) {
  return render(
    <CmpI18nProvider initialLocale="en-US">
      <CmpAmlScreeningSection
        acceptanceId={acceptanceId}
        onEnsureDraft={onEnsureDraft}
      />
    </CmpI18nProvider>
  );
}

function latestResponse({
  isStale = false,
  canReviewHits = false,
  withHit = false,
  batch = latestBatch(withHit),
}: {
  isStale?: boolean;
  canReviewHits?: boolean;
  withHit?: boolean;
  batch?: CmpAmlLatestResponse["batch"];
} = {}): CmpAmlLatestResponse {
  return {
    enabled: true,
    configured: true,
    canReviewHits,
    currentInputFingerprint: "fingerprint-1",
    isStale,
    availableSubjects: [
      {
        subjectKey: "ROOT",
        entityType: "COMPANY",
        roles: ["CLIENT"],
        displayName: "Example Limited",
        ready: true,
        warnings: [],
      },
      {
        subjectKey: "PERSON:DRAFT:owner",
        entityType: "PERSON",
        roles: ["BENEFICIAL_OWNER", "DIRECTOR"],
        displayName: "Alex Owner",
        ready: true,
        warnings: [],
      },
    ],
    batch,
  };
}

function latestBatch(
  withHit: boolean
): NonNullable<CmpAmlLatestResponse["batch"]> {
  return {
    id: "batch-1",
    acceptanceRequestId: "acceptance-1",
    clientId: null,
    requestFingerprint: "fingerprint-1",
    forceRun: false,
    status: "COMPLETED",
    subjectCount: 1,
    attentionCount: withHit ? 1 : 0,
    errorCount: 0,
    triggeredBy: { id: "manager-1", name: "Manager" },
    createdAt: "2026-09-01T03:00:00.000Z",
    completedAt: "2026-09-01T03:00:01.000Z",
    subjects: [
      {
        id: "screening-1",
        subjectKey: "ROOT",
        entityType: "COMPANY",
        roles: ["CLIENT"],
        displayName: "Example Limited",
        status: withHit ? "IN_REVIEW" : "APPROVED",
        score: withHit ? 0.8 : 0,
        totalHits: withHit ? 1 : 0,
        warnings: [],
        errorCode: null,
        errorMessage: null,
        diditRequestId: "didit-request-1",
        startedAt: "2026-09-01T03:00:00.000Z",
        completedAt: "2026-09-01T03:00:01.000Z",
        hits: withHit
          ? [
              {
                id: "hit-1",
                diditHitId: "didit-hit-1",
                reviewStatus: "UNREVIEWED",
                matchScore: 0.9,
                riskScore: 0.8,
                details: { name: "Listed Person" },
                reviewedBy: null,
                reviewedAt: null,
                reviewComment: null,
                createdAt: "2026-09-01T03:00:01.000Z",
              },
            ]
          : [],
      },
    ],
  };
}
