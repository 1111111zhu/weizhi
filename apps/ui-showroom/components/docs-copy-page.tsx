"use client";

import { DocsCopyPageContent } from "@/components/docs-copy-page-content";

export const DocsCopyPage = ({
  markdownUrl,
  url,
}: {
  markdownUrl: string;
  url: string;
}) => <DocsCopyPageContent markdownUrl={markdownUrl} url={url} />;
