"use client";

import { PlusIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { CodeBlockCommand } from "@/components/code-block-command";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { UTM_PARAMS } from "@/constants/site";
import { addQueryParams } from "@/lib/url";
import { cn } from "@/lib/utils";

export type RegistryCommands = {
  bun: string;
  npm: string;
  pnpm: string;
  yarn: string;
};

type RegistryDescriptionProps = { registryName: string };

const RegistryDescription = ({ registryName }: RegistryDescriptionProps) => (
  <>
    Run this command to add{" "}
    <a
      className="text-foreground underline underline-offset-4"
      href={addQueryParams("https://ui.shadcn.com/docs/directory", {
        q: registryName,
        ...UTM_PARAMS,
      })}
      target="_blank"
      rel="noopener"
    >
      {registryName}
    </a>{" "}
    to your project.
  </>
);

type RegistryAddButtonTriggerProps = Omit<
  React.ComponentProps<typeof Button>,
  "children"
> & {
  children?: React.ReactNode;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
};

export const RegistryAddButtonTrigger = ({
  children,
  className,
  onClick,
  size = "sm",
  variant = "ghost",
  ...props
}: RegistryAddButtonTriggerProps) => (
  <Button
    size={size}
    variant={variant}
    className={cn(className)}
    onClick={onClick}
    {...props}
  >
    {children ?? (
      <>
        <PlusIcon />
        <span className="hidden sm:inline">Add</span>
      </>
    )}
  </Button>
);

type RegistryAddButtonOverlayProps = {
  commands: RegistryCommands;
  registryName: string;
  trigger: React.ReactElement;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

export type RegistryAddButtonViewProps = Omit<
  RegistryAddButtonOverlayProps,
  "trigger"
> &
  RegistryAddButtonTriggerProps & {
    isMobile: boolean;
  };

const RegistryCommand = ({ commands }: { commands: RegistryCommands }) => (
  <CodeBlockCommand
    __bun__={commands.bun}
    __npm__={commands.npm}
    __pnpm__={commands.pnpm}
    __yarn__={commands.yarn}
    copyEvent="copy_registry_command"
  />
);

export const RegistryAddButtonDrawer = ({
  commands,
  registryName,
  trigger,
  isOpen,
  setIsOpen,
}: RegistryAddButtonOverlayProps) => (
  <Drawer open={isOpen} onOpenChange={setIsOpen} sounds>
    <DrawerTrigger asChild>{trigger}</DrawerTrigger>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Add Registry</DrawerTitle>
        <DrawerDescription>
          <RegistryDescription registryName={registryName} />
        </DrawerDescription>
      </DrawerHeader>
      <div className="px-4">
        <RegistryCommand commands={commands} />
      </div>
      <DrawerFooter>
        <DrawerClose asChild>
          <Button size="sm">Done</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);

export const RegistryAddButtonDialog = ({
  commands,
  registryName,
  trigger,
  isOpen,
  setIsOpen,
}: RegistryAddButtonOverlayProps) => (
  <Dialog open={isOpen} onOpenChange={setIsOpen} sounds>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add Registry</DialogTitle>
        <DialogDescription className="text-balance">
          <RegistryDescription registryName={registryName} />
        </DialogDescription>
      </DialogHeader>
      <RegistryCommand commands={commands} />
      <DialogFooter>
        <DialogClose asChild>
          <Button size="sm">Done</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const RegistryAddButtonView = ({
  isMobile,
  registryName,
  commands,
  isOpen,
  setIsOpen,
  children,
  ...triggerProps
}: RegistryAddButtonViewProps) => {
  const trigger = (
    <RegistryAddButtonTrigger {...triggerProps}>
      {children}
    </RegistryAddButtonTrigger>
  );

  return isMobile ? (
    <RegistryAddButtonDrawer
      commands={commands}
      registryName={registryName}
      trigger={trigger}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    />
  ) : (
    <RegistryAddButtonDialog
      commands={commands}
      registryName={registryName}
      trigger={trigger}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    />
  );
};
