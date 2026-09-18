"use client";

import { projectWingToast } from "@project-wing/ui";
import { FileUp, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IntranetDictionary } from "@/i18n/dictionaries";
import { uploadKnowledgeDocument } from "@/lib/knowledge-api";
import {
  knowledgeDepartmentIds,
  knowledgeTypeIds,
} from "@/lib/knowledge-catalog";
import type {
  KnowledgeDepartment,
  KnowledgeItem,
  KnowledgeType,
} from "@/lib/knowledge-catalog";

type ConcreteDepartment = Exclude<KnowledgeDepartment, "recent" | "all">;
type ConcreteType = Exclude<KnowledgeType, "all">;

export function KnowledgeUploadDialog({
  copy,
  department,
  onUploaded,
}: {
  copy: IntranetDictionary;
  department: KnowledgeDepartment;
  onUploaded: (item: KnowledgeItem) => void;
}) {
  const uploadCopy = copy.knowledge.upload;
  const [open, setOpen] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ConcreteType | "">("");
  const [selectedDepartment, setSelectedDepartment] = useState<
    ConcreteDepartment | ""
  >(department === "all" || department === "recent" ? "" : department);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSubmit =
    referenceCode.trim().length > 0 &&
    title.trim().length > 0 &&
    type !== "" &&
    selectedDepartment !== "" &&
    file !== null &&
    !isUploading;

  function resetForm() {
    setReferenceCode("");
    setTitle("");
    setType("");
    setSelectedDepartment(
      department === "all" || department === "recent" ? "" : department
    );
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !file || !type || !selectedDepartment) {
      return;
    }

    const body = new FormData();
    body.set("referenceCode", referenceCode.trim());
    body.set("title", title.trim());
    body.set("department", selectedDepartment);
    body.set("type", type);
    body.set("file", file);

    setIsUploading(true);

    try {
      const uploadedItem = await uploadKnowledgeDocument(body);
      onUploaded(uploadedItem);
      setOpen(false);
      resetForm();
    } catch {
      projectWingToast.error(uploadCopy.uploadError, { duration: 5000 });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !isUploading) {
          resetForm();
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload aria-hidden="true" />
          {uploadCopy.action}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl" closeLabel={uploadCopy.cancel}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{uploadCopy.title}</DialogTitle>
            <DialogDescription>{uploadCopy.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-5">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/35 px-4 py-3">
              <ShieldCheck
                className="size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs text-muted-foreground">
                  {uploadCopy.section}
                </p>
                {department === "all" || department === "recent" ? (
                  <Select
                    onValueChange={(value) =>
                      setSelectedDepartment(value as ConcreteDepartment)
                    }
                    value={selectedDepartment}
                  >
                    <SelectTrigger
                      aria-label={uploadCopy.section}
                      className="mt-1 min-w-56 bg-background"
                    >
                      <SelectValue placeholder={uploadCopy.selectSection} />
                    </SelectTrigger>
                    <SelectContent>
                      {knowledgeDepartmentIds
                        .filter(
                          (item): item is ConcreteDepartment =>
                            item !== "all" && item !== "recent"
                        )
                        .map((item) => (
                          <SelectItem key={item} value={item}>
                            {copy.departments[item]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-semibold">
                    {copy.departments[department]}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="knowledge-reference-code">
                {uploadCopy.referenceCode}
              </Label>
              <Input
                id="knowledge-reference-code"
                onChange={(event) => setReferenceCode(event.target.value)}
                placeholder={uploadCopy.referenceCodePlaceholder}
                required
                value={referenceCode}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="knowledge-title">{uploadCopy.itemTitle}</Label>
              <Input
                id="knowledge-title"
                onChange={(event) => setTitle(event.target.value)}
                placeholder={uploadCopy.itemTitlePlaceholder}
                required
                value={title}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="knowledge-type">{uploadCopy.type}</Label>
              <Select
                onValueChange={(value) => setType(value as ConcreteType)}
                value={type}
              >
                <SelectTrigger id="knowledge-type" className="w-full">
                  <SelectValue placeholder={uploadCopy.type} />
                </SelectTrigger>
                <SelectContent>
                  {knowledgeTypeIds
                    .filter((item) => item !== "all")
                    .map((item) => (
                      <SelectItem key={item} value={item}>
                        {copy.types[item]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="knowledge-file">{uploadCopy.file}</Label>
              <div className="relative flex min-w-0 items-center gap-3 rounded-lg border bg-background p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <Input
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  id="knowledge-file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  ref={fileInputRef}
                  required
                  type="file"
                />
                <Button
                  aria-hidden="true"
                  className="pointer-events-none"
                  size="sm"
                  tabIndex={-1}
                  type="button"
                  variant="outline"
                >
                  <FileUp aria-hidden="true" />
                  {uploadCopy.chooseFile}
                </Button>
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  {file?.name ?? uploadCopy.noFileSelected}
                </span>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {uploadCopy.fileHelp}
              </p>
            </div>
          </div>

          <DialogFooter>
            <ButtonGroup>
              <DialogClose asChild>
                <Button disabled={isUploading} type="button" variant="outline">
                  {uploadCopy.cancel}
                </Button>
              </DialogClose>
              <Button disabled={!canSubmit} type="submit">
                {isUploading ? uploadCopy.uploading : uploadCopy.submit}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
