"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { api } from "../api/client";
import { useI18n } from "../i18n/client";

export function InvitationPage({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { dictionary, localizedPath } = useI18n();
  const accept = useMutation({
    mutationFn: () => api.acceptInvitation(token, {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    },
  });

  return (
    <div className="grid place-items-center py-20">
      <Card className="max-w-lg p-5">
        <h1 className="text-xl font-semibold text-foreground">
          {dictionary.invitation.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {dictionary.invitation.description}
        </p>
        {accept.isSuccess ? (
          <div className="mt-5 grid gap-3">
            <p className="text-sm text-success">
              {dictionary.invitation.accepted}
            </p>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:brightness-95"
              href={localizedPath(`/engagement/${accept.data.projectId}`)}
            >
              {dictionary.invitation.enterProject}
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <Button disabled={accept.isPending} onClick={() => accept.mutate()}>
              {dictionary.invitation.accept}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
