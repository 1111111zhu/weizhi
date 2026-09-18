"use client";

import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2Response,
} from "@project-wing/shared";
import { SegmentedButtonGroup } from "@project-wing/ui";
import { Eye, FilePenLine } from "lucide-react";
import { Suspense, useState } from "react";

import { Badge } from "@/components/extend/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/extend/ui/tabs";
import { useI18n } from "@/i18n/client";

import { LanguageSwitcher } from "./language-switcher";
import { SmartFormV2Editor } from "./smart-form-v2-editor";
import type { SmartFormV2ReferenceOption } from "./smart-form-v2-editor";
import { useSmartFormV2MobileLayout } from "./smart-form-v2-expansion";
import { useSmartFormV2MobileAppearance } from "./smart-form-v2-mobile-appearance";
import { SmartFormV2Readonly } from "./smart-form-v2-readonly";

import mobileStyles from "./smart-form-v2-mobile-preview.module.css";

const EMPTY_DEFAULT_ARRAY: never[] = [];

export function SmartFormV2Preview({
  definition,
  response,
  referenceOptions = EMPTY_DEFAULT_ARRAY,
}: {
  definition: SmartFormV2CompiledDefinition;
  response?: SmartFormV2Response;
  referenceOptions?: SmartFormV2ReferenceOption[];
}) {
  const { dictionary, locale } = useI18n();
  const isMobile = useSmartFormV2MobileLayout();
  useSmartFormV2MobileAppearance(isMobile);
  const copy = dictionary.smartFormV2Preview;
  const editorCopy = dictionary.smartFormV2Editor;
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [savedResponse, setSavedResponse] = useState(response);
  // A phone read-mode switch must not discard edits or mark an unsaved draft saved.
  const [mobileDraft, setMobileDraft] = useState<SmartFormV2Response>();

  const modeNavigation = isMobile ? (
    <SegmentedButtonGroup
      label={editorCopy.editorLabel}
      value={mode}
      options={[
        { value: "edit", label: editorCopy.entryMode },
        { value: "preview", label: editorCopy.previewMode },
      ]}
      onValueChange={(next) => setMode(next as "edit" | "preview")}
    />
  ) : (
    <Tabs
      value={mode}
      onValueChange={(nextMode) =>
        nextMode && setMode(nextMode as "edit" | "preview")
      }
    >
      <TabsList aria-label={editorCopy.editorLabel}>
        <TabsTrigger value="edit">
          <FilePenLine className="size-3.5" />
          {editorCopy.entryMode}
        </TabsTrigger>
        <TabsTrigger value="preview">
          <Eye className="size-3.5" />
          {editorCopy.previewMode}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
  const mobileHeader = {
    navigation: modeNavigation,
    actionsLabel: dictionary.common.moreActions,
    closeLabel: editorCopy.closeEditor,
    actions: (
      <Suspense fallback={null}>
        <LanguageSwitcher variant="tabs" labelFormat="full" />
      </Suspense>
    ),
  };

  return (
    <main
      className={`${mobileStyles.preview} min-h-screen overflow-x-clip ${isMobile ? "" : "extend-viewer-surface"} bg-muted/40 text-foreground`}
    >
      <div
        className={`${mobileStyles.desktopToolbar} sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm`}
      >
        <div
          className={`${mobileStyles.toolbar} mx-auto flex min-h-12 w-full max-w-[1536px] flex-wrap items-center justify-between gap-2 px-3 py-2 md:flex-nowrap md:gap-4 md:px-6 md:py-0`}
        >
          <Badge
            variant="secondary"
            className={`${mobileStyles.toolbarLabel} shrink-0 gap-1.5 px-2 font-medium tracking-wide`}
          >
            {mode === "edit" ? (
              <FilePenLine className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
            {mode === "edit" ? editorCopy.editorLabel : copy.previewLabel}
          </Badge>
          <div
            className={`${mobileStyles.toolbarControls} flex max-w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-2 md:flex-none md:gap-3`}
          >
            {modeNavigation}
            <Suspense
              fallback={
                <span className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
              }
            >
              <LanguageSwitcher variant="extend-tabs" />
            </Suspense>
          </div>
        </div>
      </div>
      <div
        className={`${mobileStyles.body} px-3 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-6 md:pt-6 md:pb-[calc(8rem+env(safe-area-inset-bottom))]`}
      >
        {mode === "edit" ? (
          <SmartFormV2Editor
            mobileHeader={mobileHeader}
            definition={definition}
            initialResponse={savedResponse}
            initialDraft={mobileDraft}
            locale={locale}
            copy={editorCopy}
            referenceOptions={referenceOptions}
            onSave={setSavedResponse}
            onChange={isMobile || mobileDraft ? setMobileDraft : undefined}
          />
        ) : (
          <SmartFormV2Readonly
            mobileHeader={mobileHeader}
            definition={definition}
            response={mobileDraft ?? savedResponse}
            locale={locale}
            copy={copy}
          />
        )}
      </div>
    </main>
  );
}
