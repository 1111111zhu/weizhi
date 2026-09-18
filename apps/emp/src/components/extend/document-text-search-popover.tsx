"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button as MobileButton, MobileActionSheet } from "@project-wing/ui";
import * as React from "react";

import { Button } from "@/components/extend/ui/button";
import { Input } from "@/components/extend/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/extend/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/extend/ui/tooltip";
import { ButtonGroup } from "@/components/ui/button-group";

import styles from "./document-text-search-popover.module.css";

type DocumentTextSearchPopoverProps<TResult> = {
  controlsDisabled: boolean;
  label?: string;
  mobilePresentation?: "sheet" | "popover";
  onClear?: () => void;
  onNavigate: (result: TResult) => void;
  onSearch: (query: string) => TResult[];
};

export function DocumentTextSearchPopover<TResult>({
  controlsDisabled,
  label = "Search text",
  mobilePresentation = "popover",
  onClear,
  onNavigate,
  onSearch,
}: DocumentTextSearchPopoverProps<TResult>) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<TResult[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const mobileInputRef = React.useRef<HTMLInputElement>(null);
  const runSearch = React.useCallback(
    (nextQuery: string) => {
      const normalizedQuery = nextQuery.trim();
      const nextResults = normalizedQuery ? onSearch(normalizedQuery) : [];

      setResults(nextResults);
      setActiveIndex(0);

      if (nextResults[0]) {
        onNavigate(nextResults[0]);
      }
    },
    [onNavigate, onSearch]
  );
  const handleQueryChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextQuery = event.target.value;

      setQuery(nextQuery);
      if (!nextQuery.trim()) {
        setResults([]);
        setActiveIndex(0);
        onClear?.();
        return;
      }

      runSearch(nextQuery);
    },
    [onClear, runSearch]
  );
  const navigate = React.useCallback(
    (direction: 1 | -1) => {
      if (results.length === 0) {
        return;
      }

      const nextIndex =
        (activeIndex + direction + results.length) % results.length;

      setActiveIndex(nextIndex);
      onNavigate(results[nextIndex]);
    },
    [activeIndex, onNavigate, results]
  );
  const clearSearch = React.useCallback(() => {
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    onClear?.();
  }, [onClear]);
  const resultLabel = query.trim()
    ? results.length > 0
      ? `${activeIndex + 1} / ${results.length}`
      : "No results"
    : "No search";

  if (mobilePresentation === "sheet") {
    return (
      <>
        <MobileButton
          variant="quiet"
          className={styles.searchButton}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={mobileOpen}
          disabled={controlsDisabled}
          onClick={() => setMobileOpen(true)}
        >
          <HugeiconsIcon icon={Search01Icon} aria-hidden />
        </MobileButton>
        <MobileActionSheet
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          title={label}
          onOpenChangeComplete={(open) => {
            if (open) {
              mobileInputRef.current?.focus();
            }
          }}
        >
          <div className={styles.searchContent}>
            <Input
              ref={mobileInputRef}
              aria-label={label}
              placeholder={label}
              type="search"
              enterKeyHint="search"
              value={query}
              disabled={controlsDisabled}
              onChange={handleQueryChange}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                if (event.shiftKey) {
                  navigate(-1);
                } else if (results.length > 0) {
                  navigate(1);
                } else if (query.trim()) {
                  runSearch(query);
                }
              }}
            />
            <div className={styles.resultNavigation}>
              <output aria-live="polite">{resultLabel}</output>
              <MobileButton
                variant="quiet"
                className={styles.searchButton}
                aria-label="Previous result"
                disabled={controlsDisabled || results.length === 0}
                onClick={() => navigate(-1)}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden />
              </MobileButton>
              <MobileButton
                variant="quiet"
                className={styles.searchButton}
                aria-label="Next result"
                disabled={controlsDisabled || results.length === 0}
                onClick={() => navigate(1)}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden />
              </MobileButton>
              <MobileButton
                variant="quiet"
                disabled={controlsDisabled}
                onClick={clearSearch}
              >
                Clear
              </MobileButton>
            </div>
          </div>
        </MobileActionSheet>
      </>
    );
  }

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    disabled={controlsDisabled}
                  />
                }
              />
            }
          >
            <HugeiconsIcon icon={Search01Icon} className="size-4" />
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        initialFocus={false}
        className="w-auto max-w-[calc(100vw-1rem)] border-border/70 shadow-md/5 [&_[data-slot=popover-viewport]]:px-2 [&_[data-slot=popover-viewport]]:py-2"
      >
        <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
          <Input
            aria-label={label}
            placeholder={label}
            size="sm"
            value={query}
            className="w-36 min-w-0 border-border/70 bg-background shadow-none has-focus-visible:border-border has-focus-visible:ring-0"
            onChange={handleQueryChange}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              if (event.shiftKey) {
                navigate(-1);
              } else if (results.length > 0) {
                navigate(1);
              } else if (query.trim()) {
                runSearch(query);
              }
            }}
          />
          <span className="min-w-8 text-center text-xs text-muted-foreground tabular-nums">
            {resultLabel}
          </span>
          <ButtonGroup label="Search result navigation">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Previous result"
              disabled={results.length === 0}
              onClick={() => navigate(-1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Next result"
              disabled={results.length === 0}
              onClick={() => navigate(1)}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
          </ButtonGroup>
          <Button type="button" variant="ghost" size="xs" onClick={clearSearch}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
