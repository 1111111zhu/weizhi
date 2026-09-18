import {
  Button,
  Input,
  PersonalSettingsTabs,
  ThemePreferenceCards,
  useProjectWingTheme,
} from "@project-wing/ui";
import type { ThemePreference } from "@project-wing/ui";
import { useEffect, useState } from "react";

import type { DesktopCacheSettings } from "../shared/desktop-agent-api";
import { useDesktopAgentI18n } from "./i18n";
import { UpdateAction } from "./tray-settings-popover";
import { useDesktopAgentUpdates } from "./use-desktop-agent";
import { formatCacheBytes, workspaceCopy } from "./workspace-copy";

export function useAgentAppearance() {
  const { flavor, setFlavor } = useProjectWingTheme();
  const [preference, setPreference] = useState<ThemePreference>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("desktop-agent-appearance");
    } catch {
      /* Keep in-memory preferences when storage is unavailable. */
    }
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : flavor === "latte"
        ? "light"
        : "dark";
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const next =
        preference === "dark" || (preference === "system" && media.matches)
          ? "mocha"
          : "latte";
      if (next !== flavor) setFlavor(next);
    };
    apply();
    try {
      localStorage.setItem("desktop-agent-appearance", preference);
    } catch {
      /* The selected theme remains usable for this session. */
    }
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference, flavor, setFlavor]);
  return { preference, setPreference };
}

export function SettingsPage({
  appearance,
}: {
  appearance: ReturnType<typeof useAgentAppearance>;
}) {
  const { locale, setLocale } = useDesktopAgentI18n();
  const copy = workspaceCopy(locale);
  const { fontSize, setFontSize } = useProjectWingTheme();
  const updates = useDesktopAgentUpdates();
  const [settings, setSettings] = useState<DesktopCacheSettings | null>(null);
  const [folder, setFolder] = useState("");
  const [capacity, setCapacity] = useState("");
  const [strategy, setStrategy] = useState<"LRU" | "FIFO">("LRU");
  const [retention, setRetention] = useState("30");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setError(null);
    try {
      const value = await window.desktopAgent.getCacheSettings();
      setSettings(value);
      setFolder(value.cacheRoot);
      setCapacity(String(value.maxBytes / 1024 ** 3));
      setStrategy(value.evictionPolicy ?? "LRU");
      setRetention(String(value.idleDays ?? 30));
    } catch (error) {
      setError(error instanceof Error ? error.message : copy.unavailable);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const bytes = Math.round(Number(capacity) * 1024 ** 3);
  const dirty = Boolean(
    settings &&
    (folder !== settings.cacheRoot ||
      bytes !== settings.maxBytes ||
      strategy !== (settings.evictionPolicy ?? "LRU") ||
      Number(retention) !== (settings.idleDays ?? 30))
  );
  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const value = await window.desktopAgent.saveCacheSettings({
        cacheRoot: folder,
        maxBytes: bytes,
        evictionPolicy: strategy,
        idleDays: Number(retention),
      });
      if (value.cancelled) return;
      setSettings(value);
      setMessage(copy.saved);
    } catch (error) {
      setError(error instanceof Error ? error.message : copy.unavailable);
    } finally {
      setBusy(false);
    }
  }
  const row =
    "flex flex-wrap items-center justify-between gap-4 border-t border-border/60 py-5";
  return (
    <div className="mx-auto w-full max-w-2xl py-6">
      <div className="flex flex-col">
        <div className="space-y-3 pb-8">
          <p className="text-sm font-medium">{copy.theme}</p>
          <ThemePreferenceCards
            value={appearance.preference}
            onValueChange={appearance.setPreference}
            label={copy.theme}
            labels={{ system: copy.system, light: copy.light, dark: copy.dark }}
          />
        </div>
        <div className={row}>
          <p className="text-sm font-medium">{copy.language}</p>
          <PersonalSettingsTabs
            label={copy.language}
            value={locale}
            options={[
              { label: "简体中文", value: "zh-CN" },
              { label: "English", value: "en-US" },
            ]}
            onValueChange={setLocale}
          />
        </div>
        <div className={row}>
          <p className="text-sm font-medium">{copy.font}</p>
          <PersonalSettingsTabs
            label={copy.font}
            value={fontSize}
            options={[
              { label: copy.small, value: "sm" },
              { label: copy.medium, value: "md" },
              { label: copy.large, value: "lg" },
            ]}
            onValueChange={setFontSize}
          />
        </div>
        <div className={row}>
          <label className="text-sm font-medium" htmlFor="cache-folder">
            {copy.location}
          </label>
          <Input
            id="cache-folder"
            className="max-w-sm"
            aria-label={copy.location}
            value={folder}
            disabled={!settings || busy}
            onChange={(event) => setFolder(event.target.value)}
          />
        </div>
        <div className={row}>
          <label className="text-sm font-medium" htmlFor="cache-limit">
            {copy.limit}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="cache-limit"
              type="number"
              min="0.1"
              step="0.1"
              className="w-28"
              aria-label={copy.limit}
              value={capacity}
              disabled={!settings || busy}
              onChange={(event) => setCapacity(event.target.value)}
            />
            <span className="text-muted-foreground text-sm">GB</span>
          </div>
        </div>
        <div className={row}>
          <p className="text-sm font-medium">{copy.used}</p>
          <span className="text-muted-foreground text-sm">
            {settings ? formatCacheBytes(settings.usedBytes) : "—"}
          </span>
        </div>
        <div className={`${row} gap-2`}>
          <p className="text-sm font-medium">{copy.strategy}</p>
          <fieldset disabled={!settings || busy} className="m-0 border-0 p-0">
            <PersonalSettingsTabs
              label={copy.strategy}
              value={strategy}
              options={[
                { label: "LRU", value: "LRU" },
                { label: "FIFO", value: "FIFO" },
              ]}
              onValueChange={setStrategy}
            />
          </fieldset>
          <p className="text-muted-foreground w-full text-sm">
            {strategy === "LRU" ? copy.lruHelp : copy.fifoHelp}
          </p>
        </div>
        <div className={row}>
          <label htmlFor="cache-idle-days" className="text-sm font-medium">
            {copy.idleDays}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="cache-idle-days"
              type="number"
              min="1"
              max="3650"
              step="1"
              className="w-28"
              value={retention}
              disabled={!settings || busy}
              onChange={(event) => setRetention(event.target.value)}
            />
            <span className="text-muted-foreground text-sm">{copy.days}</span>
          </div>
        </div>
        <div className={`${row} gap-2`}>
          <p className="text-sm font-medium">{copy.policy}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {copy.policyHelp}
          </p>
        </div>
        <div className="flex justify-end gap-2 pb-6">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void load()}
          >
            {copy.retry}
          </Button>
          <Button
            size="sm"
            disabled={
              busy ||
              !dirty ||
              !folder.trim() ||
              !Number.isSafeInteger(bytes) ||
              bytes <= 0 ||
              !Number.isInteger(Number(retention)) ||
              Number(retention) < 1 ||
              Number(retention) > 3650
            }
            onClick={() => void save()}
          >
            {busy ? copy.processing : copy.save}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-destructive mb-4 text-sm">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-muted-foreground mb-4 text-sm">
            {message}
          </p>
        ) : null}
        <div className={row}>
          <div>
            <p className="text-sm font-medium">{copy.version}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {__PROJECT_WING_DESKTOP_BUILD_LABEL__}
            </p>
          </div>
          <div className="w-fit">
            <UpdateAction
              busy={updates.busy}
              state={updates.state}
              onApply={(update) => void updates.apply(update)}
              onCheck={() => void updates.check()}
              onDownload={(update) => void updates.download(update)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
