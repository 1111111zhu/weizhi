"use client";

import {
  Button,
  CollectionState,
  Input,
  MobileListItem,
} from "@project-wing/ui";
import { HardDrive, Mail, Package, Search } from "lucide-react";
import { useState } from "react";

import { initialMobileRoute, mobileRouteHref } from "./mobile-workspace-model";
import type { MobileWorkspaceContext } from "./mobile-workspace-state";

// No service identity is available in the isolated showroom. Do not collect
// credentials or simulate remote success. EMP retains its actual service panels.
export function MobileServiceSettings({
  workspace,
}: {
  workspace: MobileWorkspaceContext;
}) {
  const { route, follow } = workspace;
  const link = (section: string) => ({
    ...initialMobileRoute,
    screen: "settings" as const,
    section,
  });
  if (
    route.section === "integrations" ||
    route.section === "systemConnections"
  ) {
    const mail = route.section === "integrations";
    const next = link(mail ? "mail" : "tracking");
    return (
      <div className="grid">
        <MobileListItem
          title={mail ? "企业邮箱" : "17TRACK"}
          description={mail ? "腾讯企业邮" : "物流追踪"}
          meta="状态未确认"
          icon={mail ? <Mail /> : <Package />}
          href={mobileRouteHref(next)}
          onNavigate={follow(next)}
        />
      </div>
    );
  }
  if (route.section === "desktopAgent") {
    const next = link("agentCache");
    return (
      <div className="grid gap-4">
        <dl className="divide-y divide-border">
          {["本地服务", "连接账号", "当前版本"].map((label) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 py-3"
            >
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm">未确认</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">本地服务状态未确认。</p>
        <Button fullWidth disabled>
          打开 Desktop Agent
        </Button>
        <div className="grid">
          <MobileListItem
            title="本地文件缓存"
            icon={<HardDrive />}
            href={mobileRouteHref(next)}
            onNavigate={follow(next)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {["恢复服务", "重新配对", "检查更新", "复制诊断信息"].map((label) => (
            <Button key={label} fullWidth variant="outline" disabled>
              {label}
            </Button>
          ))}
        </div>
      </div>
    );
  }
  if (route.section === "agentCache") {
    return (
      <div className="grid gap-4">
        <dl className="divide-y divide-border">
          {["占用空间", "容量上限", "缓存位置"].map((label) => (
            <div key={label} className="grid gap-1 py-3">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd>—</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          连接 Desktop Agent 后可读取本机缓存。
        </p>
        <Button fullWidth disabled>
          选择缓存文件夹
        </Button>
      </div>
    );
  }
  const tracking = route.section === "tracking";
  return (
    <div className="grid gap-4">
      <div className="border-b border-border py-3">
        <p className="font-medium">{tracking ? "17TRACK" : "腾讯企业邮箱"}</p>
        <p className="mt-2 text-sm text-muted-foreground">连接状态未确认</p>
      </div>
      <div className="grid gap-2">
        <label
          htmlFor="mobile-connection-secret"
          className="text-sm font-medium"
        >
          {tracking ? "API Key" : "客户端专用密码"}
        </label>
        <Input
          id="mobile-connection-secret"
          type="password"
          disabled
          autoComplete="off"
        />
      </div>
      <Button fullWidth disabled>
        连接
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button fullWidth variant="outline" disabled>
          测试连接
        </Button>
        <Button fullWidth variant="outline" disabled>
          断开连接
        </Button>
      </div>
      <a
        className="inline-flex min-h-12 items-center gap-2 text-sm text-primary underline underline-offset-4"
        target="_blank"
        rel="noreferrer"
        href={
          tracking ? "https://api.17track.net/en" : "https://exmail.qq.com/"
        }
      >
        {tracking ? "获取 API Key" : "打开企业邮箱"}
      </a>
    </div>
  );
}

export function MobileRecycleBin() {
  const [query, setQuery] = useState("");
  return (
    <div className="grid gap-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="pl-9"
          aria-label="搜索已删除项目"
          placeholder="搜索项目、客户或编号"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <CollectionState
        locale="zh-CN"
        kind={query ? "filtered" : "empty"}
        title={query ? "没有匹配的已删除项目" : "回收站为空"}
        description=""
        action={
          query ? { label: "清除搜索", onClick: () => setQuery("") } : undefined
        }
      />
    </div>
  );
}
