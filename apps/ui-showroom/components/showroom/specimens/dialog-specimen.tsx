"use client";

import { ButtonGroup } from "@project-wing/ui";

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

import { SpecimenSection } from "./specimen-section";

export function DialogSpecimen() {
  return (
    <SpecimenSection
      description="The showroom's local shadcn dialog wrapper, with an accessible title, description, trigger, and close actions."
      id="dialog-specimen"
      source={{
        scope: "showroom",
        library: "@/components/ui/dialog",
        detail: "Base UI wrapper",
      }}
      title="Dialog"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open details</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review project details</DialogTitle>
              <DialogDescription>
                This is a real modal surface from the showroom wrapper. Escape,
                the close icon, and the actions all exercise the dialog
                lifecycle.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Unsaved changes are kept in the current specimen only.
            </div>
            <DialogFooter>
              <ButtonGroup>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Continue</Button>
                </DialogClose>
              </ButtonGroup>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SpecimenSection>
  );
}
