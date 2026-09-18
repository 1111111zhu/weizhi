"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CALENDAR_START_MONTH,
  CALENDAR_END_MONTH,
  formatIsoDate,
  getCalendarLocale,
  parseDateInput,
  parseIsoDate,
} from "@/lib/calendar-date";

import styles from "./confirmation-template-workbench.module.css";

export function ConfirmationDateField({
  id,
  label,
  locale,
  placeholder,
  readOnly,
  style,
  chooseLabel,
  clearLabel,
  todayLabel,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  locale: string;
  placeholder: string;
  readOnly: boolean;
  style: CSSProperties;
  chooseLabel: string;
  clearLabel: string;
  todayLabel: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState({ source: value, draft: value });
  const draft = input.source === value ? input.draft : value;
  const setDraft = (next: string) => setInput({ source: value, draft: next });
  const commit = (next: string) => {
    setDraft(next);
    if (next !== value) {
      onCommit(next);
    }
  };
  const commitDraft = () => {
    if (readOnly) {
      return;
    }
    const parsed = parseDateInput(draft);
    if (!draft.trim() || parsed) {
      commit(parsed ? formatIsoDate(parsed) : "");
    } else {
      setDraft(value);
    }
  };
  return (
    <Popover open={open && !readOnly} onOpenChange={setOpen}>
      <div className="relative z-10 h-full w-full" style={style}>
        <Input
          id={id}
          aria-label={label}
          aria-readonly={readOnly}
          readOnly={readOnly}
          className="h-full w-full min-w-0 rounded-sm border border-primary bg-transparent py-0 pr-5 pl-1 leading-none text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-0"
          style={{ ...style, height: "100%" }}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder || "YYYY-MM-DD"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
        />
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={readOnly}
              aria-label={`${label}: ${chooseLabel}`}
              className={`absolute top-0 right-0 min-h-0 w-5 rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none ${styles.fillHeight}`}
            >
              <CalendarDays className="size-3.5" />
            </Button>
          }
        />
      </div>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-auto overflow-hidden border border-border bg-popover p-0 shadow-lg"
        data-testid="confirmation-date-calendar"
      >
        <Calendar
          mode="single"
          locale={getCalendarLocale(locale)}
          selected={parseIsoDate(value)}
          defaultMonth={parseIsoDate(value) ?? new Date()}
          captionLayout="dropdown"
          startMonth={CALENDAR_START_MONTH}
          endMonth={CALENDAR_END_MONTH}
          className="bg-popover p-2"
          onSelect={(date) => {
            if (date) {
              commit(formatIsoDate(date));
              setOpen(false);
            }
          }}
        />
        <div className="flex justify-between border-t border-border p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              commit("");
              setOpen(false);
            }}
          >
            {clearLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              commit(formatIsoDate(new Date()));
              setOpen(false);
            }}
          >
            {todayLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
