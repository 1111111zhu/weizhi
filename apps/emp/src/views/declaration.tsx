"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { api } from "../api/client";
import type { User } from "../api/client";
import { useI18n } from "../i18n/client";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/engagement";
  }
  return value;
}

export function DeclarationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { dictionary, localizedPath } = useI18n();
  const redirectTo = safeRedirect(searchParams.get("redirect"));
  const accept = useMutation({
    mutationFn: api.acceptDeclaration,
    onSuccess: async () => {
      const acceptedAt = new Date().toISOString();
      queryClient.setQueryData<User>(["me"], (current) =>
        current
          ? {
              ...current,
              declarationAccepted: true,
              declarationAcceptedAt: acceptedAt,
            }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push(localizedPath(redirectTo));
    },
  });

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <Card className="max-w-2xl p-5">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface text-success">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          {dictionary.declaration.title}
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          {dictionary.declaration.body}
        </p>
        <Button
          className="mt-6"
          disabled={accept.isPending}
          onClick={() => accept.mutate()}
        >
          {dictionary.declaration.confirm}
        </Button>
      </Card>
    </main>
  );
}
