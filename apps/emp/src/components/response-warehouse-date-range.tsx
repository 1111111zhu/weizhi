"use client";

import { UI_UNIT_LABELS } from "@project-wing/ui";
import { CalendarDays, X } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import {
  formatIsoDate,
  getCalendarLocale,
  parseDateInput,
  parseIsoDate,
} from "../lib/calendar-date";
import { Button } from "./ui/button";
import { Calendar, CalendarDayButton } from "./ui/calendar";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function ResponseWarehouseDateRange({
  clearLabel,
  from,
  fromLabel,
  locale,
  maximumDate,
  minimumDate,
  onChange,
  rangeLabel,
  to,
  toLabel,
}: {
  clearLabel: string;
  from: string;
  fromLabel: string;
  locale: string;
  maximumDate: Date;
  minimumDate: Date;
  onChange: (from: string, to: string) => void;
  rangeLabel: string;
  to: string;
  toLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [fromInput, setFromInput] = useState({ source: from, draft: from });
  const [toInput, setToInput] = useState({ source: to, draft: to });
  const fromDraft = fromInput.source === from ? fromInput.draft : from;
  const toDraft = toInput.source === to ? toInput.draft : to;
  const setFromDraft = (draft: string) => setFromInput({ source: from, draft });
  const setToDraft = (draft: string) => setToInput({ source: to, draft });
  const [calendarRange, setCalendarRange] = useState<DateRange>();
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<Date>();

  const selected: DateRange = {
    from: parseIsoDate(from),
    to: parseIsoDate(to),
  };
  const displayedRange =
    choosingEnd && hoveredDate && calendarRange?.from
      ? hoveredDate < calendarRange.from
        ? { from: hoveredDate, to: calendarRange.from }
        : { from: calendarRange.from, to: hoveredDate }
      : calendarRange;
  const setCalendarOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setCalendarRange(selected);
      setChoosingEnd(false);
      setHoveredDate(undefined);
    }
  };
  const commitDraft = (side: "from" | "to") => {
    const draft = side === "from" ? fromDraft : toDraft;
    const parsed = parseDateInput(draft);
    if (!parsed) {
      if (side === "from") {
        setFromDraft(from);
      } else {
        setToDraft(to);
      }
      return;
    }
    const normalized = formatIsoDate(parsed);
    onChange(
      side === "from" ? normalized : from,
      side === "to" ? normalized : to
    );
  };
  const updateDraft = (side: "from" | "to", draft: string) => {
    if (side === "from") {
      setFromDraft(draft);
    } else {
      setToDraft(draft);
    }
    const parsed = parseDateInput(draft);
    if (parsed) {
      const normalized = formatIsoDate(parsed);
      onChange(
        side === "from" ? normalized : from,
        side === "to" ? normalized : to
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setCalendarOpen}>
      <fieldset
        aria-label={rangeLabel}
        className="relative flex h-8 items-center overflow-hidden rounded-lg border border-input bg-background shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20"
      >
        <legend className="sr-only">{rangeLabel}</legend>
        <PopoverTrigger
          nativeButton={false}
          render={
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              tabIndex={-1}
            />
          }
        />
        <label className="sr-only" htmlFor="confirmation-response-date-from">
          {fromLabel}
        </label>
        <Input
          id="confirmation-response-date-from"
          aria-label={fromLabel}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={UI_UNIT_LABELS.datePattern}
          value={fromDraft}
          onClick={() => setCalendarOpen(true)}
          onChange={(event) => updateDraft("from", event.target.value)}
          onBlur={() => commitDraft("from")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitDraft("from");
            }
          }}
          className="h-full w-[8.75rem] rounded-none border-0 bg-transparent px-3 text-xs tabular-nums shadow-none focus-visible:ring-0"
        />
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          –
        </span>
        <label className="sr-only" htmlFor="confirmation-response-date-to">
          {toLabel}
        </label>
        <Input
          id="confirmation-response-date-to"
          aria-label={toLabel}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={UI_UNIT_LABELS.datePattern}
          value={toDraft}
          onClick={() => setCalendarOpen(true)}
          onChange={(event) => updateDraft("to", event.target.value)}
          onBlur={() => commitDraft("to")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitDraft("to");
            }
          }}
          className="h-full w-[8.75rem] rounded-none border-0 bg-transparent px-3 text-xs tabular-nums shadow-none focus-visible:ring-0"
        />
        {from || to ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={clearLabel}
            className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              setFromDraft("");
              setToDraft("");
              setCalendarRange(undefined);
              setHoveredDate(undefined);
              setOpen(false);
              onChange("", "");
            }}
          >
            <X />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={rangeLabel}
          onClick={() => setCalendarOpen(true)}
        >
          <CalendarDays className="size-4 text-muted-foreground" />
        </Button>
      </fieldset>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-auto overflow-hidden border border-border bg-popover p-0 shadow-lg"
        data-testid="response-date-range-calendar"
      >
        <Calendar
          mode="range"
          locale={getCalendarLocale(locale)}
          selected={
            choosingEnd ? { from: undefined, to: undefined } : displayedRange
          }
          modifiers={{
            previewStart: displayedRange?.from ?? [],
            previewEnd: displayedRange?.to ?? [],
            previewMiddle:
              displayedRange?.from && displayedRange.to
                ? { after: displayedRange.from, before: displayedRange.to }
                : [],
          }}
          components={{
            DayButton: (props) => (
              <CalendarDayButton
                {...props}
                locale={getCalendarLocale(locale)}
                modifiers={{
                  ...props.modifiers,
                  selected: Boolean(
                    props.modifiers.previewStart ||
                    props.modifiers.previewMiddle ||
                    props.modifiers.previewEnd
                  ),
                  range_start: props.modifiers.previewStart,
                  range_end: props.modifiers.previewEnd,
                  range_middle: props.modifiers.previewMiddle,
                }}
              />
            ),
          }}
          defaultMonth={selected.from ?? maximumDate}
          captionLayout="dropdown"
          startMonth={minimumDate}
          endMonth={maximumDate}
          disabled={{ before: minimumDate, after: maximumDate }}
          classNames={{
            today:
              "rounded-(--cell-radius) text-foreground data-[selected=true]:rounded-none",
          }}
          className="bg-popover p-2 [&_[data-range-end=true]]:transition-colors [&_[data-range-end=true]]:duration-150 motion-reduce:[&_[data-range-end=true]]:duration-75 [&_[data-range-middle=true]]:transition-colors [&_[data-range-middle=true]]:duration-150 motion-reduce:[&_[data-range-middle=true]]:duration-75 [&_[data-range-start=true]]:transition-colors [&_[data-range-start=true]]:duration-150 motion-reduce:[&_[data-range-start=true]]:duration-75"
          onDayMouseEnter={setHoveredDate}
          onDayClick={(date) => {
            if (!choosingEnd || !calendarRange?.from) {
              setCalendarRange({ from: date, to: undefined });
              setChoosingEnd(true);
              setHoveredDate(undefined);
              return;
            }
            const nextFrom =
              date < calendarRange.from ? date : calendarRange.from;
            const nextTo =
              date < calendarRange.from ? calendarRange.from : date;
            setCalendarRange({ from: nextFrom, to: nextTo });
            setHoveredDate(undefined);
            onChange(formatIsoDate(nextFrom), formatIsoDate(nextTo));
            setChoosingEnd(false);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
