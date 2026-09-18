"use client";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
const formatIsoDate = (date: Date) => format(date, "yyyy-MM-dd");
const formatDateOnly = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
export function ResponseReceivedCalendarField({
  locale,
  id,
  ariaLabel,
  clearLabel,
  onChange,
  placeholder,
  todayLabel,
  value,
}: {
  locale: string;
  id?: string;
  ariaLabel?: string;
  clearLabel?: string;
  onChange: (value: string) => void;
  placeholder: string;
  todayLabel: string;
  value: string;
}) {
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useCalendarOutsideDismissal(open, setOpen, contentRef, triggerRef);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            aria-label={ariaLabel}
            ref={triggerRef}
            type="button"
            variant="outline"
            className="w-full justify-start font-normal"
          />
        }
      >
        <CalendarDays />
        {selected
          ? formatDateOnly(selected.toISOString(), locale)
          : placeholder}
      </PopoverTrigger>
      <PopoverContent
        collisionAvoidance={{
          side: "shift",
          align: "shift",
          fallbackAxisSide: "none",
        }}
        side="bottom"
        align="start"
        sideOffset={4}
        className="w-auto p-0"
      >
        <Card
          ref={contentRef}
          size="sm"
          className="w-fit max-w-[300px]"
          data-slot="response-calendar-preset-surface"
        >
          <CardContent className="p-0">
            <Calendar
              locale={locale.startsWith("zh") ? zhCN : enUS}
              mode="single"
              selected={selected}
              captionLayout="dropdown"
              startMonth={new Date(2000, 0)}
              endMonth={new Date(2100, 11)}
              className="p-0 [--cell-size:--spacing(9.5)]"
              onSelect={(date) => {
                if (date) {
                  onChange(formatIsoDate(date));
                }
              }}
            />
          </CardContent>
          <CardFooter
            data-slot="response-calendar-preset-footer"
            className="flex flex-wrap gap-2 border-t border-border/40 bg-card"
          >
            {clearLabel && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 bg-card"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                {clearLabel}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 bg-card"
              onClick={() => onChange(formatIsoDate(new Date()))}
            >
              {todayLabel}
            </Button>
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  );
}

function useCalendarOutsideDismissal(
  open: boolean,
  setOpen: (open: boolean) => void,
  contentRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnOutsideInteraction = (event: MouseEvent | PointerEvent) => {
      const { target } = event;
      if (!(target instanceof Node)) {
        return;
      }
      if (contentRef.current?.contains(target)) {
        return;
      }
      if (triggerRef.current?.contains(target)) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest('[data-slot="select-content"]')
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideInteraction, true);
    document.addEventListener("click", closeOnOutsideInteraction, true);
    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutsideInteraction,
        true,
      );
      document.removeEventListener("click", closeOnOutsideInteraction, true);
    };
  }, [contentRef, open, setOpen, triggerRef]);
}
