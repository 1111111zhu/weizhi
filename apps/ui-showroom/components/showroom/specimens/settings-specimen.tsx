"use client";

import {
  Badge,
  Button,
  Input,
  SettingsDialogShell,
  ThemePreferenceCards,
} from "@project-wing/ui";
import type { ThemePreference } from "@project-wing/ui";
import { Link, Settings, Keyboard } from "lucide-react";
import { useState } from "react";

import { SpecimenSection } from "./specimen-section";

const items = [
  { id: "personal", label: "个性化", icon: Settings },
  {
    id: "connections",
    label: "连接与集成",
    icon: Link,
    badge: (
      <Badge size="xs" radius="full" variant="secondary">
        3
      </Badge>
    ),
  },
  { id: "keyboard", label: "键盘与操作", icon: Keyboard },
];

export function SettingsSpecimen() {
  const [active, setActive] = useState("personal");
  const [dark, setDark] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");
  return (
    <div
      className={
        dark
          ? "dark w-full bg-background text-foreground"
          : "w-full bg-background text-foreground"
      }
    >
      <SpecimenSection
        title="主题预览卡片"
        id="theme-preferences"
        description="系统、浅色、深色的共享单选控件。Tab 聚焦，方向键切换；图示仅说明主题，不更改文档原色。"
        source={{
          scope: "shared",
          library: "@project-wing/ui",
          detail: "ThemePreferenceCards",
        }}
      >
        <ThemePreferenceCards
          label="主题"
          value={theme}
          onValueChange={setTheme}
          labels={{ system: "系统", light: "浅色", dark: "深色" }}
        />
        <ThemePreferenceCards
          label="主题（不可用示例）"
          value="dark"
          onValueChange={setTheme}
          disabled
          labels={{ system: "系统", light: "浅色", dark: "深色" }}
        />
      </SpecimenSection>
      <SpecimenSection
        title="共享设置框架"
        id="settings-shell"
        description="这是实际的 SettingsDialogShell；产品中的外层弹窗仍由各应用托管。缩窄窗口时，先显示分类列表，点入详情后可以返回；桌面侧栏保留。示例不会修改账号设置。"
        source={{
          scope: "shared",
          library: "@project-wing/ui",
          detail: "SettingsDialogShell · ViewSwitcher",
        }}
      >
        <Button variant="outline" onClick={() => setDark((value) => !value)}>
          {dark ? "切换浅色示例" : "切换深色示例"}
        </Button>
        <div className="h-128 min-h-0 overflow-hidden rounded-lg border border-border">
          <SettingsDialogShell
            mobileNavigation="pages"
            mobileBackLabel="返回设置"
            activeId={active}
            breadcrumbRoot="设置"
            items={items}
            navigationLabel="设置分类"
            onActiveIdChange={setActive}
            headerActions={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDark((value) => !value)}
              >
                {dark ? "浅色" : "深色"}
              </Button>
            }
          >
            {active === "personal" ? (
              <div key="personal" className="grid max-w-lg gap-3">
                <label
                  className="text-sm font-medium"
                  htmlFor="settings-demo-name"
                >
                  显示名称
                </label>
                <Input id="settings-demo-name" defaultValue="Jony Ma" />
                <p className="text-sm text-muted-foreground">
                  字段与帮助文字保持对齐；数据只保留在本示例。
                </p>
                <label
                  className="text-sm font-medium"
                  htmlFor="settings-demo-account"
                >
                  账号标识（只读）
                </label>
                <Input
                  id="settings-demo-account"
                  value="demo-account"
                  readOnly
                />
              </div>
            ) : active === "connections" ? (
              <div key="connections" className="grid max-w-lg gap-3">
                <label
                  className="text-sm font-medium"
                  htmlFor="settings-demo-connection"
                >
                  连接名称
                </label>
                <Input
                  id="settings-demo-connection"
                  value="未连接（示例）"
                  disabled
                />
                <output className="text-sm text-muted-foreground">
                  不可用的字段保留原因，不以空白代替连接状态。
                </output>
              </div>
            ) : (
              <div key="keyboard" className="space-y-3 text-sm">
                <p>Tab：移动到下一个操作。</p>
                <p>方向键：浏览选择器或菜单中的选项。</p>
                <p>Enter：确认当前操作；Esc：关闭弹层并返回入口。</p>
              </div>
            )}
          </SettingsDialogShell>
        </div>
      </SpecimenSection>
    </div>
  );
}
