import { SelectContent as SharedSelectContent } from "@project-wing/ui";
import type { ComponentProps } from "react";

export {
  Select,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@project-wing/ui";

export function SelectContent(
  props: ComponentProps<typeof SharedSelectContent>
) {
  return <SharedSelectContent {...props} mobilePresentation="sheet" />;
}
