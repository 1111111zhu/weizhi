"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CALENDAR_START_MONTH,
  CALENDAR_END_MONTH,
  formatIsoDate,
  getCalendarLocale,
  parseIsoDate,
} from "@/lib/calendar-date";

export function ConfirmationReceivedDateField({
  id,
  label,
  locale,
  value,
  onChange,
}: {
  id: string;
  label: string;
  locale: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, time = "00:00"] = value.split("T");
  const [hour = "00", minute = "00"] = time.split(":");
  const chinese = locale === "zh-CN";
  const updateTime = (nextHour: string, nextMinute: string) =>
    onChange(`${date || formatIsoDate(new Date())}T${nextHour}:${nextMinute}`);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label={label}
            className="w-full min-w-0 justify-between px-2.5 font-normal"
          />
        }
      >
        <span className="truncate">
          {value ? `${date.replaceAll("-", "/")} ${hour}:${minute}` : label}
        </span>
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionAvoidance={{
          side: "none",
          align: "shift",
          fallbackAxisSide: "none",
        }}
        className="max-h-(--available-height) w-auto gap-0 overflow-y-auto border border-border p-0"
        data-testid="confirmation-received-date-calendar"
      >
        <Calendar
          mode="single"
          required
          locale={getCalendarLocale(locale)}
          selected={parseIsoDate(date)}
          defaultMonth={parseIsoDate(date) ?? new Date()}
          captionLayout="dropdown"
          startMonth={CALENDAR_START_MONTH}
          endMonth={CALENDAR_END_MONTH}
          className="bg-popover p-3 [--cell-size:--spacing(8)]"
          onSelect={(selected) => {
            if (selected) {
              onChange(`${formatIsoDate(selected)}T${hour}:${minute}`);
            }
          }}
        />
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <span className="mr-auto text-sm text-muted-foreground">
            {chinese ? "时间" : "Time"}
          </span>
          {[
            {
              value: hour,
              count: 24,
              label: chinese ? "小时" : "Hour",
              change: (next: string) => updateTime(next, minute),
            },
            {
              value: minute,
              count: 60,
              label: chinese ? "分钟" : "Minute",
              change: (next: string) => updateTime(hour, next),
            },
          ].map((part) => (
            <Select
              key={part.label}
              value={part.value}
              onValueChange={(next) => {
                if (next) {
                  part.change(next);
                }
              }}
            >
              <SelectTrigger label={part.label} className="w-16">
                <SelectValue>{part.value}</SelectValue>
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                side="bottom"
                align="start"
                collisionAvoidance={{
                  side: "none",
                  align: "shift",
                  fallbackAxisSide: "none",
                }}
              >
                {Array.from({ length: part.count }, (_, index) =>
                  String(index).padStart(2, "0")
                ).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
        <div className="flex justify-between border-t border-border p-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              onChange(`${formatIsoDate(new Date())}T${hour}:${minute}`)
            }
          >
            {chinese ? "今天" : "Today"}
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            {chinese ? "确定" : "Done"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
