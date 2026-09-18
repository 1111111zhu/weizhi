"use client";

import { ContextMenu as ContextPrimitive } from "@base-ui/react/context-menu";
import type { ReactElement, ReactNode } from "react";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type ActionMenuItem =
  | {
      kind: "action";
      id: string;
      label: string;
      onSelect: () => void;
      disabled?: boolean;
      danger?: boolean;
    }
  | {
      kind: "checkbox";
      id: string;
      label: string;
      checked: boolean;
      onCheckedChange: (checked: boolean) => void;
      disabled?: boolean;
    }
  | {
      kind: "radio";
      id: string;
      label: string;
      value: string;
      options: readonly { value: string; label: string; disabled?: boolean }[];
      onValueChange: (value: string) => void;
    }
  | {
      kind: "submenu";
      id: string;
      label: string;
      items: readonly ActionMenuItem[];
      disabled?: boolean;
    }
  | { kind: "separator"; id: string };

function MenuItems({ items }: { items: readonly ActionMenuItem[] }) {
  return items.map((item) => {
    switch (item.kind) {
      case "action": {
        return (
          <DropdownMenuItem
            key={item.id}
            disabled={item.disabled}
            variant={item.danger ? "destructive" : "default"}
            onClick={() => item.onSelect()}
          >
            {item.label}
          </DropdownMenuItem>
        );
      }
      case "checkbox": {
        return (
          <DropdownMenuCheckboxItem
            key={item.id}
            checked={item.checked}
            disabled={item.disabled}
            closeOnClick={false}
            onCheckedChange={(checked) => item.onCheckedChange(checked)}
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        );
      }
      case "radio": {
        return (
          <DropdownMenuRadioGroup
            key={item.id}
            value={item.value}
            onValueChange={(value) => {
              if (
                typeof value === "string" &&
                item.options.some(
                  (option) => option.value === value && !option.disabled
                )
              ) {
                item.onValueChange(value);
              }
            }}
          >
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            {item.options.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        );
      }
      case "submenu": {
        return (
          <DropdownMenuSub key={item.id}>
            <DropdownMenuSubTrigger disabled={item.disabled}>
              {item.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <MenuItems items={item.items} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      }
      case "separator": {
        return <DropdownMenuSeparator key={item.id} />;
      }
      default: {
        return null;
      }
    }
  });
}

export type ActionMenuProps = {
  label: string;
  items: readonly ActionMenuItem[];
  icon?: ReactNode;
  disabled?: boolean;
};
export function ActionMenu({ label, items, icon, disabled }: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={<Button type="button" variant="outline" aria-label={label} />}
      >
        {icon ?? label}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <MenuItems items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type ContextMenuProps = {
  label: string;
  items: readonly ActionMenuItem[];
  target: ReactElement;
};
export function ContextMenu({ label, items, target }: ContextMenuProps) {
  return (
    <ContextPrimitive.Root>
      <ContextPrimitive.Trigger
        render={target}
        tabIndex={0}
        aria-label={label}
      />
      <ContextPrimitive.Portal>
        <ContextPrimitive.Positioner className="z-50" sideOffset={4}>
          <ContextPrimitive.Popup className="border-border bg-popover text-popover-foreground min-w-40 rounded-lg border p-1 shadow-lg">
            <MenuItems items={items} />
          </ContextPrimitive.Popup>
        </ContextPrimitive.Positioner>
      </ContextPrimitive.Portal>
    </ContextPrimitive.Root>
  );
}

export type SplitButtonProps = {
  label: string;
  onClick: () => void;
  menuLabel: string;
  items: readonly ActionMenuItem[];
  disabled?: boolean;
};
export function SplitButton({
  label,
  onClick,
  menuLabel,
  items,
  disabled,
}: SplitButtonProps) {
  return (
    <fieldset aria-label={label} className="inline-flex items-stretch gap-1">
      <Button type="button" disabled={disabled} onClick={onClick}>
        {label}
      </Button>
      <ActionMenu label={menuLabel} items={items} disabled={disabled} />
    </fieldset>
  );
}
