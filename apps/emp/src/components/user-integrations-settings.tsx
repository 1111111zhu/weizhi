"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Info, MailCheck, Unplug } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { api } from "../api/client";
import { useI18n } from "../i18n/client";
import { useToast } from "./toast";

export function UserIntegrationsSettings() {
  const queryClient = useQueryClient();
  const { dictionary } = useI18n();
  const { toast } = useToast();
  const copy = dictionary.workbench.settingsPanel.integrations;
  const [clientPassword, setClientPassword] = useState("");
  const connection = useQuery({
    queryKey: ["user-mail-connection"],
    queryFn: api.userMailConnection,
  });
  const connect = useMutation({
    mutationFn: api.connectUserMail,
    onSuccess: (result) => {
      queryClient.setQueryData(["user-mail-connection"], result);
      setClientPassword("");
      toast({ title: copy.connected });
    },
    onError: (_unused_error) =>
      toast({
        title: copy.connectionError,
        variant: "destructive",
      }),
  });
  const test = useMutation({
    mutationFn: api.testUserMailConnection,
    onSuccess: (result) => {
      queryClient.setQueryData(["user-mail-connection"], result);
      toast({ title: copy.testSuccess });
    },
    onError: (_unused_error) =>
      toast({
        title: copy.connectionError,
        variant: "destructive",
      }),
  });
  const disconnect = useMutation({
    mutationFn: api.disconnectUserMail,
    onSuccess: (result) => {
      queryClient.setQueryData(["user-mail-connection"], result);
      toast({ title: copy.disconnected });
    },
    onError: (_unused_error) =>
      toast({
        title: copy.connectionError,
        variant: "destructive",
      }),
  });
  const isPending =
    connection.isPending ||
    connect.isPending ||
    test.isPending ||
    disconnect.isPending;
  const isConnected = connection.data?.status === "CONNECTED";

  return (
    <section data-testid="user-integrations-settings">
      <div className="grid items-center gap-4 rounded-lg border border-border/70 bg-card p-4 lg:grid-cols-[minmax(12rem,1fr)_24rem_auto]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted/60">
            <Image
              src="/brands/tencent-enterprise-mail.ico"
              alt=""
              width={32}
              height={16}
              className="h-5 w-auto"
            />
          </span>
          <div className="min-w-0">
            <h4 className="font-medium text-foreground">{copy.mailTitle}</h4>
            {connection.isLoading ? (
              <Skeleton className="mt-1 h-4 w-40 rounded-sm" />
            ) : (
              <p className="truncate text-sm text-muted-foreground">
                {connection.data?.emailAddress ?? copy.notConnected}
              </p>
            )}
          </div>
        </div>
        {isConnected ? (
          <ButtonGroup className="justify-self-end lg:col-start-3">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => test.mutate()}
            >
              <MailCheck />
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
        ) : (
          <div className="min-w-0">
            <Label
              className="sr-only"
              htmlFor="enterprise-mail-client-password"
            >
              {copy.clientPassword}
            </Label>
            <Input
              id="enterprise-mail-client-password"
              type="password"
              autoComplete="new-password"
              placeholder={copy.clientPassword}
              className="w-96 max-w-full"
              value={clientPassword}
              onChange={(event) => setClientPassword(event.target.value)}
            />
          </div>
        )}
        {isConnected ? null : (
          <div className="flex items-center gap-1.5 justify-self-end">
            <PasswordGuide copy={copy} />
            <Button
              type="button"
              disabled={isPending || !clientPassword.trim()}
              onClick={() => connect.mutate(clientPassword.trim())}
            >
              <MailCheck />
              {copy.connect}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function PasswordGuide({
  copy,
}: {
  copy: ReturnType<
    typeof useI18n
  >["dictionary"]["workbench"]["settingsPanel"]["integrations"];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Tooltip open={isOpen} onOpenChange={setIsOpen}>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            tooltip={copy.passwordGuide}
            onClick={() => setIsOpen(true)}
          >
            <Info />
          </Button>
        }
      />
      <TooltipContent side="top" className="max-w-80 text-left leading-5">
        <p>
          <a
            href="https://exmail.qq.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-primary"
          >
            {copy.passwordGuideSteps[0]}
            <ExternalLink className="size-3.5" />
          </a>
          {` · ${copy.passwordGuideSteps[1]} · ${copy.passwordGuideSteps[2]}`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
