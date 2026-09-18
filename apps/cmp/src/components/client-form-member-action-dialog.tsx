"use client";

import { useMemo, useState } from "react";

import type { DirectoryUser } from "../api/client";
import {
  MemberDirectorySearch,
  MemberDirectoryTable,
  getMemberRoleLabel,
} from "./client-form-member-directory";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

export type ClientFormMemberActionDialogCopy = {
  actionLabel: string;
  actionsColumn: string;
  emptyLabel: string;
  memberColumn: string;
  memberCountOne: string;
  memberCountOther: string;
  rankColumn: string;
  roleColumn: string;
  searchLabel: string;
  title: string;
};

export type ClientFormMemberActionKind = "assign" | "submit";

export function ClientFormMemberActionDialog({
  actionKind,
  copy,
  isBusy,
  open,
  users,
  onConfirm,
  onOpenChange,
}: {
  actionKind: ClientFormMemberActionKind;
  copy: ClientFormMemberActionDialogCopy;
  isBusy?: boolean;
  open: boolean;
  users: DirectoryUser[];
  onConfirm: (user: DirectoryUser) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setQuery("");
    }
    onOpenChange(nextOpen);
  };

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return users;
    }
    return users.filter((user) =>
      [user.name, user.email, getMemberRoleLabel(user.globalRole)].some(
        (value) => value.toLocaleLowerCase().includes(normalizedQuery)
      )
    );
  }, [query, users]);
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-emp-settings-member-dialog=""
        overlayClassName="bg-black/50! backdrop-blur-none!"
        className="h-[80dvh]! max-h-[80dvh]! w-auto! max-w-[calc(100vw-2rem)]! min-w-[min(48rem,calc(100vw-2rem))]! gap-0 overflow-hidden rounded-[10px] border border-neutral-200 bg-popover p-0 shadow-lg sm:max-w-[calc(100vw-2rem)]! [&>[data-slot=dialog-close]]:top-2 [&>[data-slot=dialog-close]]:right-2 [&>[data-slot=dialog-close]]:size-8 [&>[data-slot=dialog-close]]:rounded-[8px] [&>[data-slot=dialog-close]]:border-0 [&>[data-slot=dialog-close]]:p-0 [&>[data-slot=dialog-close]]:text-black [&>[data-slot=dialog-close]]:opacity-70 [&>[data-slot=dialog-close]]:hover:opacity-100"
      >
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>
        <div className="flex h-full max-h-[80dvh] w-full max-w-full bg-popover">
          <main className="grid h-full min-h-0 min-w-0 flex-1 grid-rows-[4rem_minmax(0,1fr)]">
            <header className="relative flex h-16 shrink-0 items-center gap-2">
              <span className="px-4 text-base font-semibold text-black">
                {copy.title} ...
              </span>
              <MemberDirectorySearch
                copy={copy}
                count={visibleUsers.length}
                query={query}
                onQueryChange={setQuery}
              />
            </header>

            <div className="min-h-0 overflow-auto px-4 pt-2 pb-6">
              <MemberDirectoryTable
                actionKind={actionKind}
                copy={copy}
                disabled={isBusy}
                users={visibleUsers}
                onAction={onConfirm}
              />
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
