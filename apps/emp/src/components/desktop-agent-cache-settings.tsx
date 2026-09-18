"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldTitle } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  DesktopAgentClientError,
  getDesktopAgentCacheSettings,
  updateDesktopAgentCacheSettings,
} from "../api/desktop-agent";
import { useI18n } from "../i18n/client";
import { defaultDesktopAgentCacheCopy } from "../i18n/dictionaries";
import { useToast } from "./toast";

const CACHE_SETTINGS_QUERY_KEY = ["desktop-agent", "cache-settings"];
const CACHE_LABEL_CLASS =
  "flex items-center justify-self-start gap-1.5 whitespace-nowrap text-sm font-medium text-foreground";
export function DesktopAgentCacheSettings() {
  const { dictionary } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const copy =
    dictionary.workbench.settingsPanel.desktopAgentCache ??
    defaultDesktopAgentCacheCopy;
  const [cacheRoot, setCacheRoot] = useState("");
  const settings = useQuery({
    queryKey: CACHE_SETTINGS_QUERY_KEY,
    queryFn: () => getDesktopAgentCacheSettings(),
    retry: false,
  });
  const errorCopy =
    settings.error instanceof DesktopAgentClientError &&
    settings.error.code === "NOT_FOUND"
      ? (copy.upgradeRequired ?? copy.unavailable)
      : copy.unavailable;

  useEffect(() => {
    if (settings.data) {
      setCacheRoot(settings.data.cacheRoot);
    }
  }, [settings.data]);

  const update = useMutation({
    mutationFn: (nextCacheRoot: string) =>
      updateDesktopAgentCacheSettings({
        cacheRoot: nextCacheRoot,
        maxBytes: settings.data?.maxBytes ?? 5 * 1024 * 1024 * 1024,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(CACHE_SETTINGS_QUERY_KEY, result);
      toast({ title: copy.saved });
      if (result.restartRequired) {
        window.setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: CACHE_SETTINGS_QUERY_KEY,
          });
        }, 1500);
      }
    },
    onError: (error) =>
      toast({
        title:
          error instanceof DesktopAgentClientError &&
          error.code === "CACHE_CHANGE_REQUIRES_IDLE"
            ? (copy.requiresIdle ?? defaultDesktopAgentCacheCopy.requiresIdle)
            : error instanceof DesktopAgentClientError &&
                error.code === "CACHE_LOCATION_IN_USE"
              ? (copy.rootInUse ?? defaultDesktopAgentCacheCopy.rootInUse)
              : copy.saveError,
        variant: "destructive",
      }),
  });

  const canSave =
    !settings.isPending &&
    !settings.isError &&
    !update.isPending &&
    Boolean(cacheRoot.trim()) &&
    cacheRoot !== settings.data?.cacheRoot;

  return (
    <Field
      orientation="horizontal"
      className="flex-col items-stretch gap-4 border-t border-border/60 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
      data-testid="desktop-agent-cache-settings"
    >
      <FieldTitle className={CACHE_LABEL_CLASS}>
        {copy.title}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={copy.title}
              >
                <Info className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent side="top" className="max-w-64 text-left leading-5">
            <div className="grid gap-1">
              <p>{copy.description}</p>
              {settings.data ? (
                <p>
                  {copy.capacity
                    .replace(
                      "{used}",
                      formatCapacity(settings.data?.usedBytes ?? 0)
                    )
                    .replace(
                      "{size}",
                      formatCapacity(settings.data?.maxBytes ?? 5 * 1024 ** 3)
                    )}
                </p>
              ) : null}
              {settings.data ? (
                <p>
                  {(
                    copy.performance ??
                    "Cache hits: {hits}; download avoided: {saved}"
                  )
                    .replace("{hits}", String(settings.data?.hitCount ?? 0))
                    .replace(
                      "{saved}",
                      formatCapacity(settings.data?.bytesSaved ?? 0)
                    )}
                </p>
              ) : null}
            </div>
          </TooltipContent>
        </Tooltip>
      </FieldTitle>
      <div className="w-full min-w-0 sm:max-w-md">
        <InputGroup>
          <InputGroupInput
            id="desktop-agent-cache-root"
            value={cacheRoot}
            disabled={
              settings.isPending || settings.isError || update.isPending
            }
            placeholder={settings.isPending ? copy.loading : copy.placeholder}
            aria-label={copy.location}
            onChange={(event) => setCacheRoot(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (canSave) {
                  update.mutate(cacheRoot);
                }
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              disabled={!canSave}
              onClick={() => update.mutate(cacheRoot)}
            >
              {update.isPending ? copy.saving : copy.save}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {settings.isError ? (
          <div className="mt-2 flex flex-wrap items-start gap-2">
            <p
              role="alert"
              className="min-w-0 flex-1 text-sm leading-5 text-destructive-text"
            >
              {errorCopy}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={settings.isFetching}
              onClick={() => {
                void settings.refetch();
              }}
            >
              {copy.retry ?? "Retry"}
            </Button>
          </div>
        ) : null}
      </div>
    </Field>
  );
}

function formatCapacity(bytes: number) {
  if (bytes === 0) {
    return "0B";
  }
  const gigabytes = bytes / 1024 ** 3;
  return Number.isInteger(gigabytes)
    ? `${gigabytes}GB`
    : `${gigabytes.toFixed(1)}GB`;
}
