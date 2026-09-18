"use client";

import { DocsShareMenuContent } from "@/components/docs-share-menu-content";

export const DocsShareMenu = ({
  title,
  url,
}: {
  title: string;
  url: string;
}) => <DocsShareMenuContent title={title} url={url} />;
