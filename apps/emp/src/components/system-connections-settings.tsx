"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, PlugZap, RefreshCw, Unplug } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { api } from "../api/client";
import { useI18n } from "../i18n/client";
import { getUserFacingErrorMessage } from "../lib/error-toast";
import { cn } from "../lib/utils";
import { useToast } from "./toast";

export function SystemConnectionsSettings() {
  const queryClient = useQueryClient();
  const { dictionary } = useI18n();
  const { toast } = useToast();
  const copy = dictionary.workbench.settingsPanel.systemConnections;
  const [apiKey, setApiKey] = useState("");
  const connection = useQuery({
    queryKey: ["system-connection", "17track"],
    queryFn: api.tracking17TrackConnection,
  });
  const connect = useMutation({
    mutationFn: api.connectTracking17Track,
    onSuccess: (result) => {
      queryClient.setQueryData(["system-connection", "17track"], result);
      setApiKey("");
      toast({ title: copy.connected });
    },
    onError: showErrorToast(copy.connectionError, toast),
  });
  const test = useMutation({
    mutationFn: api.testTracking17TrackConnection,
    onSuccess: (result) => {
      queryClient.setQueryData(["system-connection", "17track"], result);
      toast({ title: copy.testSuccess });
    },
    onError: showErrorToast(copy.connectionError, toast),
  });
  const disconnect = useMutation({
    mutationFn: api.disconnectTracking17Track,
    onSuccess: (result) => {
      queryClient.setQueryData(["system-connection", "17track"], result);
      toast({ title: copy.disconnected });
    },
    onError: showErrorToast(copy.connectionError, toast),
  });
  const isPending =
    connection.isPending ||
    connect.isPending ||
    test.isPending ||
    disconnect.isPending;
  const isConnected = connection.data?.status === "CONNECTED";

  return (
    <section className="grid gap-4" data-testid="system-connections-settings">
      <h3 className="text-base font-semibold text-foreground">{copy.title}</h3>
      <div className="grid gap-4 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted/60 p-2">
              <Image
                src="/brands/17track.svg"
                alt=""
                width={128}
                height={90}
                className="h-7 w-auto"
              />
            </span>
            <div className="min-w-0">
              <h4 className="font-medium text-foreground">
                {copy.providerName}
              </h4>
              <p className="text-sm text-muted-foreground">
                {copy.trackingService}
              </p>
            </div>
          </div>
          <Badge
            className={cn(
              "shrink-0",
              isConnected &&
                "border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-800"
            )}
            variant={isConnected ? "default" : "secondary"}
          >
            {isConnected
              ? copy.connected
              : connection.data?.status === "ERROR"
                ? copy.connectionError
                : copy.notConnected}
          </Badge>
        </div>

        {isConnected ? (
          <>
            <dl className="grid grid-cols-3 gap-3 border-y border-border/60 py-3">
              <QuotaMetric
                label={copy.quotaTotal}
                value={connection.data?.quotaTotal}
              />
              <QuotaMetric
                label={copy.quotaUsed}
                value={connection.data?.quotaUsed}
              />
              <QuotaMetric
                label={copy.quotaRemain}
                value={connection.data?.quotaRemain}
              />
            </dl>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => test.mutate()}
              >
                <RefreshCw />
                {copy.test}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => disconnect.mutate()}
              >
                <Unplug />
                {copy.disconnect}
              </Button>
            </ButtonGroup>
          </>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="tracking-17track-api-key">{copy.apiKey}</Label>
                <a
                  className={buttonVariants({ variant: "link", size: "sm" })}
                  href="https://api.17track.net/en"
                  target="_blank"
                  rel="noreferrer"
                >
                  {copy.getApiKey}
                  <ExternalLink data-icon="inline-end" />
                </a>
              </div>
              <Input
                id="tracking-17track-api-key"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
            <Button
              type="button"
              className="justify-self-start"
              disabled={isPending || !apiKey.trim()}
              onClick={() => connect.mutate(apiKey.trim())}
            >
              <PlugZap />
              {copy.connect}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function QuotaMetric({
  label,
  value,
}: {
  label: string;
  value?: number | null;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-foreground">
        {value ?? "—"}
      </dd>
    </div>
  );
}

function showErrorToast(
  title: string,
  toast: (input: {
    title: string;
    description?: string;
    variant?: "destructive";
  }) => void
) {
  return (error: Error) =>
    toast({
      title,
      description: getUserFacingErrorMessage(error, title),
      variant: "destructive",
    });
}
