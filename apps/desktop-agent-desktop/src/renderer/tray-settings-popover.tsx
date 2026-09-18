import {
  Button,
  IconButton,
  MorphPopover,
  MorphPopoverContent,
  MorphPopoverTrigger,
  PersonalSettingsGrid,
  PersonalSettingsTabs,
  Separator,
  useProjectWingTheme,
} from "@project-wing/ui";
import {
  CheckIcon,
  DownloadIcon,
  MoonStarIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";

import type { DesktopAgentUpdate } from "../shared/desktop-agent-api";
import type { DesktopAgentCopy } from "./i18n";
import { useDesktopAgentI18n } from "./i18n";
import type { UpdateState } from "./use-desktop-agent";

type TraySettingsPopoverProps = {
  busy: boolean;
  open?: boolean;
  state: UpdateState;
  onApply: (update: DesktopAgentUpdate) => void;
  onCheck: () => void;
  onDownload: (update: DesktopAgentUpdate) => void;
  onOpenChange?: (open: boolean) => void;
};

function TraySettingsPopover(props: TraySettingsPopoverProps) {
  const { copy, locale, setLocale } = useDesktopAgentI18n();
  const { flavor, fontSize, setFlavor, setFontSize } = useProjectWingTheme();
  return (
    <MorphPopover open={props.open} onOpenChange={props.onOpenChange}>
      <MorphPopoverTrigger>
        <IconButton
          icon={<SettingsIcon />}
          label={copy.settings}
          size="icon-sm"
          variant="quiet"
        />
      </MorphPopoverTrigger>
      <MorphPopoverContent
        align="end"
        className="tray-settings-popover"
        side="bottom"
        sideOffset={8}
      >
        <PersonalSettingsGrid
          appearanceLabel={copy.appearance}
          appearanceControl={
            <PersonalSettingsTabs
              label={copy.appearance}
              options={[
                {
                  label: (
                    <>
                      <SunIcon data-icon="inline-start" />
                      {copy.day}
                    </>
                  ),
                  value: "latte",
                },
                {
                  label: (
                    <>
                      <MoonStarIcon data-icon="inline-start" />
                      {copy.night}
                    </>
                  ),
                  value: "mocha",
                },
              ]}
              value={flavor}
              onValueChange={setFlavor}
            />
          }
          fontSizeLabel={copy.fontSize}
          fontSizeControl={
            <PersonalSettingsTabs
              label={copy.fontSize}
              options={[
                { label: copy.fontSizeOptions.sm, value: "sm" },
                { label: copy.fontSizeOptions.md, value: "md" },
                { label: copy.fontSizeOptions.lg, value: "lg" },
              ]}
              value={fontSize}
              onValueChange={setFontSize}
            />
          }
          languageLabel={copy.language}
          languageControl={
            <PersonalSettingsTabs
              label={copy.language}
              options={[
                { label: copy.languageShortOptions["zh-CN"], value: "zh-CN" },
                { label: copy.languageShortOptions["en-US"], value: "en-US" },
              ]}
              value={locale}
              onValueChange={setLocale}
            />
          }
        />
        <Separator className="tray-settings-separator" />
        <UpdateAction {...props} />
      </MorphPopoverContent>
    </MorphPopover>
  );
}

export default TraySettingsPopover;

export function UpdateAction({
  busy,
  onApply,
  onCheck,
  onDownload,
  state,
}: TraySettingsPopoverProps) {
  const { copy } = useDesktopAgentI18n();
  const action = getUpdateAction(state, { onApply, onCheck, onDownload }, copy);
  return (
    <Button
      className="tray-update-action"
      disabled={busy}
      iconStart={action.icon}
      loading={state.kind === "checking" || state.kind === "downloading"}
      onClick={action.handleClick}
      size="xs"
      variant="secondary"
    >
      {action.label}
    </Button>
  );
}

type UpdateCallbacks = Pick<
  TraySettingsPopoverProps,
  "onApply" | "onCheck" | "onDownload"
>;

function getUpdateAction(
  state: UpdateState,
  callbacks: UpdateCallbacks,
  copy: DesktopAgentCopy
) {
  if (state.kind === "available") {
    return {
      icon: <DownloadIcon />,
      label: copy.downloadVersion(state.update.targetVersion),
      handleClick: () => callbacks.onDownload(state.update),
    };
  }
  if (state.kind === "ready") {
    return {
      icon: <RotateCcwIcon />,
      label: copy.restartToUpdate,
      handleClick: () => callbacks.onApply(state.update),
    };
  }
  if (state.kind === "checking" || state.kind === "downloading") {
    return {
      icon: <RefreshCwIcon />,
      label:
        state.kind === "checking"
          ? copy.checkingForUpdates
          : copy.downloadingUpdate,
      handleClick: callbacks.onCheck,
    };
  }
  return {
    icon: state.kind === "current" ? <CheckIcon /> : <RefreshCwIcon />,
    label: copy.checkForUpdates,
    handleClick: callbacks.onCheck,
  };
}
