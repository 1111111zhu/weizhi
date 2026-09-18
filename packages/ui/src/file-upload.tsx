"use client";

import { Field } from "./field";
import { FileInput } from "./file-input";
import type { FileInputProps } from "./file-input";
import { Progress } from "./progress";
import { Spinner } from "./spinner";

export type FileUploadProps = Omit<FileInputProps, "onChange"> & {
  label: string;
  description?: string;
  error?: string;
  loading?: boolean;
  progress?: number;
  onFilesChange: (files: File[]) => void;
};
/** Chooses files and reports caller-owned progress; it never uploads or reads their contents. */
export function FileUpload({
  label,
  description,
  error,
  loading,
  progress,
  onFilesChange,
  disabled,
  id,
  required,
  ...props
}: FileUploadProps) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      id={id}
      required={required}
      disabled={disabled || loading}
    >
      {(control) => (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <FileInput
              {...props}
              {...control}
              aria-busy={loading || undefined}
              onChange={(event) =>
                onFilesChange([...(event.target.files ?? [])])
              }
            />
            {loading ? <Spinner aria-hidden="true" /> : null}
          </div>
          {loading || progress !== undefined ? (
            <Progress label={label} value={progress} />
          ) : null}
        </>
      )}
    </Field>
  );
}
