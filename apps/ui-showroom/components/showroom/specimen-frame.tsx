"use client";

import { ButtonGroup } from "@project-wing/ui";
import {
  ExternalLinkIcon,
  MonitorIcon,
  RefreshCwIcon,
  SmartphoneIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES, withShowroomBasePath } from "@/constants/routes";
import { cn } from "@/lib/utils";

type PreviewViewport = "desktop" | "narrow";

function SpecimenToolbar({
  onReload,
  onViewportChange,
  specimenPath,
  viewport,
}: {
  onReload: () => void;
  onViewportChange: (viewport: PreviewViewport) => void;
  specimenPath: string;
  viewport: PreviewViewport;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
      <Tabs
        onValueChange={(value) => onViewportChange(value as PreviewViewport)}
        value={viewport}
      >
        <TabsList aria-label="Preview viewport">
          <TabsTrigger value="desktop">
            <MonitorIcon aria-hidden="true" /> Desktop
          </TabsTrigger>
          <TabsTrigger value="narrow">
            <SmartphoneIcon aria-hidden="true" /> Narrow
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <ButtonGroup>
        <Button
          aria-label="Reload specimen"
          onClick={onReload}
          size="icon-sm"
          variant="ghost"
        >
          <RefreshCwIcon data-icon="inline-start" />
        </Button>
        <Button asChild size="icon-sm" variant="ghost">
          <Link href={specimenPath} target="_blank">
            <ExternalLinkIcon data-icon="inline-start" />
            <span className="sr-only">Open specimen in a new tab</span>
          </Link>
        </Button>
      </ButtonGroup>
    </div>
  );
}

function SpecimenViewport({
  family,
  reloadKey,
  specimenUrl,
  viewport,
}: {
  family: string;
  reloadKey: number;
  specimenUrl: string;
  viewport: PreviewViewport;
}) {
  return (
    <div className="flex min-h-[28rem] justify-center overflow-hidden bg-muted/25 p-4 sm:p-8">
      <iframe
        className={cn(
          "h-[26rem] border bg-background shadow-sm transition-[width] duration-200 ease-out",
          viewport === "narrow" ? "w-[23.5rem] max-w-full" : "w-full"
        )}
        key={reloadKey}
        sandbox="allow-forms allow-popups allow-scripts"
        src={specimenUrl}
        title={`${family} isolated component preview`}
      />
    </div>
  );
}

export function SpecimenFrame({ family }: { family: string }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const specimenPath = `${ROUTES.SPECIMENS}/${encodeURIComponent(family)}`;
  const specimenUrl = withShowroomBasePath(specimenPath);

  return (
    <section aria-label={`${family} interactive specimen`} className="border">
      <SpecimenToolbar
        onReload={() => setReloadKey((current) => current + 1)}
        onViewportChange={setViewport}
        specimenPath={specimenPath}
        viewport={viewport}
      />
      <SpecimenViewport
        family={family}
        reloadKey={reloadKey}
        specimenUrl={specimenUrl}
        viewport={viewport}
      />
    </section>
  );
}
