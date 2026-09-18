"use client";

import { FileInput } from "@project-wing/ui";
import { FileText, Upload, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

export function ConfirmationResponseFilePicker({
  id,
  label,
  help,
  accept,
  locale,
  files,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  accept: string;
  locale: string;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chinese = locale === "zh-CN";
  return (
    <div className="grid min-w-0 gap-2">
      <FileInput
        ref={inputRef}
        id={id}
        aria-label={label}
        multiple
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const next = [...files];
          for (const file of event.target.files ?? []) {
            if (
              !next.some(
                (existing) =>
                  existing.name === file.name &&
                  existing.size === file.size &&
                  existing.lastModified === file.lastModified
              )
            ) {
              next.push(file);
            }
          }
          onChange(next);
          event.target.value = "";
        }}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer hover:border-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {chinese
            ? files.length
              ? "继续添加文件"
              : "选择文件（可多选）"
            : files.length
              ? "Add more files"
              : "Choose files (multiple)"}
        </Button>
        {files.length ? (
          <span className="text-xs text-muted-foreground">
            {chinese ? `已选 ${files.length} 份` : `${files.length} selected`}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
      {files.length ? (
        <ul className="grid max-h-40 gap-1.5 overflow-y-auto">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/20 px-2 py-1"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span
                className="min-w-0 flex-1 truncate text-sm"
                title={file.name}
              >
                {file.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`${chinese ? "移除" : "Remove"} ${file.name}`}
                onClick={() =>
                  onChange(files.filter((_, fileIndex) => fileIndex !== index))
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
