"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { MotionButton } from "./motion-button";
import {
  ProjectWingTopBarMotionPopover,
  ProjectWingTopBarMotionPopoverTrigger,
} from "./project-wing-motion-popover";
import { ProjectWingTopBarMotionPopoverContent } from "./project-wing-motion-popover-content";

export type DevelopmentAccount = {
  email: string;
  name: string;
  password: string;
  role: string;
};

type DevelopmentAccountSelectorProps = {
  accounts: readonly DevelopmentAccount[];
  disabled?: boolean;
  emptyLabel: string;
  label: string;
  loading?: boolean;
  loadingLabel: string;
  onSelect: (account: DevelopmentAccount) => void;
};

type DevelopmentAccountListProps = Omit<
  DevelopmentAccountSelectorProps,
  "disabled" | "label"
>;

export function DevelopmentAccountList({
  accounts,
  emptyLabel,
  loading = false,
  loadingLabel,
  onSelect,
}: DevelopmentAccountListProps) {
  return (
    <div className="pw-auth-development-account-list">
      {loading ? (
        <p className="pw-auth-development-account-status">{loadingLabel}</p>
      ) : null}
      {!loading && accounts.length === 0 ? (
        <p className="pw-auth-development-account-status">{emptyLabel}</p>
      ) : null}
      {loading
        ? null
        : accounts.map((account) => (
            <MotionButton
              className="pw-auth-development-account-option"
              key={account.email}
              onClick={() => onSelect(account)}
              variant="ghost"
            >
              <span className="pw-auth-development-account-option-heading">
                <span>{account.name}</span>
                <span>{account.role}</span>
              </span>
              <span className="pw-auth-development-account-option-email">
                {account.email}
              </span>
            </MotionButton>
          ))}
    </div>
  );
}

export function DevelopmentAccountSelector({
  accounts,
  disabled = false,
  emptyLabel,
  label,
  loading = false,
  loadingLabel,
  onSelect,
}: DevelopmentAccountSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <ProjectWingTopBarMotionPopover
      align="end"
      className="pw-auth-development-account-root"
      onOpenChange={setOpen}
      open={open}
      panelRadius={12}
      sideOffset={8}
    >
      <ProjectWingTopBarMotionPopoverTrigger>
        <MotionButton
          aria-label={label}
          className="pw-auth-password-toggle hover:bg-transparent"
          disabled={disabled}
          size="icon"
          variant="ghost"
        >
          <ChevronDown aria-hidden="true" data-icon="inline-end" />
        </MotionButton>
      </ProjectWingTopBarMotionPopoverTrigger>
      <ProjectWingTopBarMotionPopoverContent
        aria-label={label}
        className="pw-auth-development-account-menu"
      >
        <div aria-label={label} role="group">
          <DevelopmentAccountList
            accounts={accounts}
            emptyLabel={emptyLabel}
            loading={loading}
            loadingLabel={loadingLabel}
            onSelect={(account) => {
              onSelect(account);
              setOpen(false);
            }}
          />
        </div>
      </ProjectWingTopBarMotionPopoverContent>
    </ProjectWingTopBarMotionPopover>
  );
}
