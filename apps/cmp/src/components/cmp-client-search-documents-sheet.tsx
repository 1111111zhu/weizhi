"use client";

import type { CmpClient } from "@project-wing/shared";
import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { Badge, projectWingToast as toast } from "@project-wing/ui";
import {
  Building2,
  Download,
  Eye,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/api/client";
import type {
  CmpClientSearchDocument,
  CmpClientSearchDocumentCategory,
} from "@/api/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { FileInput } from "@/components/ui/file-input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCmpI18n } from "@/i18n/client";
import { openAuthorizedPreviewWindow } from "@/lib/open-preview-window";

import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

export function CmpClientSearchDocumentsSheet({
  client,
  canEdit,
  onOpenChange,
}: {
  client: CmpClient | null;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const [category, setCategory] =
    useState<CmpClientSearchDocumentCategory>("AML_SEARCH");
  const [pendingDelete, setPendingDelete] =
    useState<CmpClientSearchDocument | null>(null);
  const [documentItems, setDocumentItems] = useState<CmpClientSearchDocument[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const loadDocuments = useCallback(async () => {
    if (!client) {
      return;
    }
    loadRequestIdRef.current += 1;
    const requestId = loadRequestIdRef.current;
    setIsLoading(true);
    try {
      const result = await api.cmpClientSearchDocuments(client.id, category);
      if (mountedRef.current && requestId === loadRequestIdRef.current) {
        setDocumentItems(result.documents);
      }
    } catch {
      if (mountedRef.current && requestId === loadRequestIdRef.current) {
        toast.error(copy.searchDocumentsLoadFailed, { duration: 5000 });
      }
    } finally {
      if (mountedRef.current && requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [category, client, copy.searchDocumentsLoadFailed]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const uploadFile = async (file: File) => {
    if (!client) {
      return;
    }
    setIsUploading(true);
    try {
      await api.uploadCmpClientSearchDocument(client.id, category, file);
      await loadDocuments();
    } catch {
      if (mountedRef.current) {
        toast.error(copy.searchUploadFailed);
      }
    } finally {
      if (mountedRef.current) {
        setIsUploading(false);
      }
    }
  };
  const deleteFile = async (documentId: string) => {
    setIsDeleting(true);
    try {
      await api.deleteCmpClientSearchDocument(documentId);
      if (mountedRef.current) {
        setPendingDelete(null);
      }
      await loadDocuments();
    } catch {
      if (mountedRef.current) {
        toast.error(copy.searchDeleteFailed);
      }
    } finally {
      if (mountedRef.current) {
        setIsDeleting(false);
      }
    }
  };
  const uploadLabel =
    category === "AML_SEARCH" ? copy.uploadAmlSearch : copy.uploadCompanySearch;

  return (
    <>
      <Sheet open={Boolean(client)} onOpenChange={onOpenChange}>
        <SheetContent
          className="w-[min(60rem,100vw)] max-w-[60rem] border-border/80 bg-background shadow-none [&>[data-slot=sheet-close]]:top-6 [&>[data-slot=sheet-close]]:right-6"
          closeLabel={copy.close}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/80 pr-10 pb-2 sm:flex-nowrap">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <SheetTitle className="truncate text-lg">
                  {client?.nameEn ?? client?.nameZh}
                </SheetTitle>
                <Badge
                  aria-label={`${client?.nameEn ?? client?.nameZh}: ${documentItems.length}`}
                  className="size-5 p-0"
                  radius="full"
                  variant="info-outline"
                >
                  {documentItems.length}
                </Badge>
              </div>
              <Tabs
                className="shrink-0"
                value={category}
                onValueChange={(value) =>
                  setCategory(value as CmpClientSearchDocumentCategory)
                }
              >
                <TabsList className="w-auto bg-muted/70">
                  <TabsTrigger className="gap-2" value="AML_SEARCH">
                    <ShieldCheck className="size-4" />
                    {copy.amlSearchShort}
                  </TabsTrigger>
                  <TabsTrigger className="gap-2" value="COMPANY_SEARCH">
                    <Building2 className="size-4" />
                    {copy.companySearchShort}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {canEdit ? (
                <>
                  <FileInput
                    ref={fileInputRef}
                    accept={FILE_ACCEPT}
                    aria-label={uploadLabel}
                    disabled={isUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) {
                        void uploadFile(file);
                      }
                    }}
                  />
                  <Button
                    aria-label={uploadLabel}
                    size="sm"
                    variant="secondary"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Skeleton className="size-4 rounded-full" />
                    ) : (
                      <Upload />
                    )}
                    {copy.uploadSearchMaterialShort}
                  </Button>
                </>
              ) : null}
            </div>

            <DocumentList
              copy={copy}
              documents={documentItems}
              isLoading={isLoading}
              locale={locale}
              canEdit={canEdit}
              onDelete={setPendingDelete}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {copy.deleteSearchDocumentTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {copy.deleteSearchDocumentDescription.replace(
                "{fileName}",
                pendingDelete?.fileName ?? ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => {
                if (pendingDelete) {
                  void deleteFile(pendingDelete.id);
                }
              }}
            >
              {isDeleting ? (
                <Skeleton className="mr-1.5 inline-block size-3.5 rounded-full" />
              ) : null}
              {copy.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DocumentList({
  copy,
  documents,
  isLoading,
  locale,
  canEdit,
  onDelete,
}: {
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"];
  documents: CmpClientSearchDocument[];
  isLoading: boolean;
  locale: string;
  canEdit: boolean;
  onDelete: (document: CmpClientSearchDocument) => void;
}) {
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const columns = useMemo<SearchDocumentColumn[]>(() => {
    const header = (title: string) =>
      function SearchDocumentColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<
          CmpClientSearchDocument,
          unknown
        >["column"];
      }) {
        return (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={title}
          />
        );
      };

    return [
      {
        accessorKey: "fileName",
        id: "fileName",
        header: header(copy.searchFileName),
        cell: ({ row }) => (
          <strong className="block truncate font-medium text-foreground">
            {row.original.fileName}
          </strong>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.searchFileName },
        minSize: 180,
        size: 230,
      },
      {
        accessorFn: (document) => document.uploadedBy.name,
        id: "uploadedBy",
        header: header(copy.searchUploadedBy),
        cell: ({ row }) => (
          <span className="block truncate text-foreground">
            {row.original.uploadedBy.name}
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.searchUploadedBy },
        minSize: 150,
        size: 150,
      },
      {
        accessorFn: (document) => formatDate(document.createdAt, locale),
        id: "createdAt",
        header: header(copy.searchUploadedAt),
        cell: ({ row }) => (
          <span className="block truncate text-muted-foreground">
            {formatDate(row.original.createdAt, locale)}
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        sortingFn: (left, right) =>
          new Date(left.original.createdAt).getTime() -
          new Date(right.original.createdAt).getTime(),
        meta: { autoSize: true, headerTitle: copy.searchUploadedAt },
        minSize: 170,
        size: 180,
      },
      {
        accessorFn: (document) => formatFileSize(document.fileSize),
        id: "fileSize",
        header: header(copy.searchFileSize),
        cell: ({ row }) => (
          <span className="block truncate text-muted-foreground tabular-nums">
            {formatFileSize(row.original.fileSize)}
          </span>
        ),
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        sortingFn: (left, right) =>
          left.original.fileSize - right.original.fileSize,
        meta: { autoSize: true, headerTitle: copy.searchFileSize },
        minSize: 110,
        size: 110,
      },
      {
        id: "actions",
        header: copy.actions,
        cell: ({ row }) => {
          const document = row.original;
          return (
            <ButtonGroup>
              <Button
                size="icon-sm"
                variant="quiet"
                tooltip={copy.previewSearchDocument.replace(
                  "{fileName}",
                  document.fileName
                )}
                onClick={() => {
                  void openAuthorizedPreviewWindow({
                    fileName: document.fileName,
                    mimeType: document.mimeType,
                    loadBlob: () =>
                      api.loadCmpClientSearchDocument(document.id),
                  }).then((opened) => {
                    if (!opened) {
                      toast.error(copy.searchPreviewFailed);
                    }
                  });
                }}
              >
                <Eye />
              </Button>
              <Button
                size="icon-sm"
                variant="quiet"
                tooltip={copy.downloadSearchDocument.replace(
                  "{fileName}",
                  document.fileName
                )}
                nativeButton={false}
                render={
                  <a
                    href={api.cmpClientSearchDocumentDownloadUrl(document.id)}
                    aria-label={copy.downloadSearchDocument.replace(
                      "{fileName}",
                      document.fileName
                    )}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <Download />
              </Button>
              {canEdit ? (
                <Button
                  size="icon-sm"
                  variant="quiet"
                  tooltip={copy.deleteSearchDocument.replace(
                    "{fileName}",
                    document.fileName
                  )}
                  onClick={() => onDelete(document)}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </ButtonGroup>
          );
        },
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: { headerTitle: copy.actions },
        minSize: 112,
        size: 112,
      },
    ];
  }, [canEdit, copy, locale, menuCopy, onDelete]);

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label={copy.searchLoadingDocuments}
        className="flex flex-1 flex-col gap-3 p-4"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="h-3 w-1/3 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-4/5 rounded-md" />
            <Skeleton className="h-3 w-2/5 rounded-md" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1">
      <CmpMasterDataGrid
        mobile={{
          titleColumn: "fileName",
          summaryColumns: ["fileSize", "createdAt"],
        }}
        columns={columns}
        data={documents}
        emptyMessage={copy.searchNoDocuments}
        getRowId={(document) => document.id}
        initialSorting={[{ id: "createdAt", desc: true }]}
        showRecordCount={false}
        showRowSelection={false}
        showToolbar={false}
        tableLabel={copy.searchMaterials}
        tableLayout={{ headerSticky: true, columnsVisibility: false }}
        testId="cmp-client-search-documents-data-grid"
        title={copy.searchMaterials}
      />
    </div>
  );
}

type SearchDocumentColumn =
  ProjectWingMasterDataGridProps<CmpClientSearchDocument>["columns"][number];

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
