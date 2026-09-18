import { Frame, FramePanel } from "@project-wing/ui";
import type { FocusEventHandler, ReactNode, Ref } from "react";

import { FormWizardStepper } from "./cmp-form-controls";
import type { FormWizardStep } from "./cmp-form-controls";

export function AcceptanceFormHeader({ children }: { children: ReactNode }) {
  return <header className="cmp-form-workspace-header">{children}</header>;
}

export function AcceptanceFormWorkspace({
  children,
  header,
  framed = true,
  contentRef,
  steps,
  activeStepId,
  stepperLabel,
  onStepChange,
  onBlurCapture,
}: {
  children: ReactNode;
  header?: ReactNode;
  framed?: boolean;
  contentRef?: Ref<HTMLElement>;
  steps: FormWizardStep[];
  activeStepId: string;
  stepperLabel: string;
  onStepChange: (stepId: string) => void;
  onBlurCapture?: FocusEventHandler<HTMLElement>;
}) {
  const content = (
    <>
      <FormWizardStepper
        steps={steps}
        activeStepId={activeStepId}
        ariaLabel={stepperLabel}
        onStepChange={onStepChange}
      />
      <fieldset
        ref={contentRef as Ref<HTMLFieldSetElement>}
        className="cmp-form-workspace-content m-0 min-w-0 border-0 p-0"
        onBlurCapture={onBlurCapture}
      >
        {children}
      </fieldset>
    </>
  );

  return (
    <>
      {header}
      {framed ? (
        <Frame
          className="cmp-form-workspace-frame min-h-0 min-w-0 overflow-hidden"
          dense
          stacked
        >
          <FramePanel className="cmp-form-workspace-frame-panel min-h-0 p-0 shadow-none">
            {content}
          </FramePanel>
        </Frame>
      ) : (
        content
      )}
    </>
  );
}
