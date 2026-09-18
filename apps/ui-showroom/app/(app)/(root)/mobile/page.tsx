import Link from "next/link";

import "@project-wing/ui/mobile-workspace.css";

import { ShowroomPageHeader } from "@/components/showroom/page-header";
import { MobilePatternCatalog } from "@/components/showroom/specimens/mobile-pattern-catalog";

export default function MobileProposalPage() {
  return (
    <main lang="zh-CN" className="grid gap-10 pb-16">
      <ShowroomPageHeader
        title="手机工作台 · 设计提案"
        description="沿用 EMP 的品牌与数据语义，为触控重新组织导航、列表、详情和操作。当前为 Experimental，不替换现有业务页面。"
      />
      <nav
        aria-label="提案目录"
        className="flex flex-wrap gap-4 text-sm text-primary"
      >
        <Link href="/specimens/MobileMaterialSystem">
          Material 3 组件与状态
        </Link>
        <a href="#navigation">导航</a>
        <a href="#lists">列表</a>
        <a href="#overlays">操作面板</a>
        <a href="#states">状态</a>
      </nav>
      <MobilePatternCatalog />
      <section className="grid gap-4 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">组合交互样例</h2>
        <p className="text-sm text-muted-foreground">
          项目列表 → 底稿 → 阅读布局 →
          批注。筛选、导航、本地回复和主题切换可交互，使用合成数据，不连接业务
          API。
        </p>
        <Link
          className="inline-flex min-h-12 w-fit items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
          href="/specimens/MobileWorkspace"
        >
          打开手机样例
        </Link>
      </section>
    </main>
  );
}
