"use client";

import {
  Button,
  CollectionState,
  ComboboxField,
  Input,
  MaterialSurface,
  SegmentedButtonGroup,
  FloatingActionButton,
  MobileActionSheet,
  ProjectWingMasterDataGrid,
  ProjectWingToaster,
  projectWingToast,
  ResponsiveDialogSurface,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@project-wing/ui";
import { Plus, Moon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const columns = [
  { accessorKey: "name", header: "项目" },
  { accessorKey: "state", header: "状态" },
];
const rows = [
  { id: "1", name: "Orchid 年度审计", state: "进行中" },
  { id: "2", name: "Harbour 往来核对", state: "待复核" },
];
const destinations = [
  { value: "", label: "未选择" },
  { value: "audit", label: "审计团队 / Audit team" },
  {
    value: "review",
    label: "跨地区质量复核团队 / Cross-region quality review",
  },
  { value: "unavailable", label: "暂不可用的团队", disabled: true },
];
export function MobileMaterialSystem() {
  const [mode, setMode] = useState("all");
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [category, setCategory] = useState("all");
  const [emptyFilter, setEmptyFilter] = useState(true);
  const [destination, setDestination] = useState("audit");
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    return () => {
      root.classList.toggle("dark", wasDark);
    };
  }, [dark]);
  return (
    <main className="pw-material-page grid gap-4" lang="zh-CN">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">移动端组件系统</h1>
        <Button
          variant="quiet"
          size="icon"
          aria-label="切换深色模式"
          onClick={() => setDark(!dark)}
        >
          <Moon />
        </Button>
      </header>
      <p className="text-sm text-muted-foreground">
        Material 3 · 组件验证，不连接业务数据。电脑版样式不变。
      </p>
      <Button
        variant="outline"
        nativeButton={false}
        render={
          <Link
            href="/specimens/MobileIntranet"
            aria-label="体验 Intranet 手机导航原型"
          />
        }
      >
        体验 Intranet 手机导航原型
      </Button>
      <SegmentedButtonGroup
        label="记录状态"
        value={mode}
        options={[
          { value: "all", label: "全部" },
          { value: "pending", label: "待处理" },
        ]}
        onValueChange={setMode}
      />
      <MaterialSurface>
        <h2 className="mb-3 font-semibold">操作与状态</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => projectWingToast.success("已完成演示操作")}>
            保存
          </Button>
          <Button variant="secondary">次要操作</Button>
          <Button variant="outline">描边</Button>
          <Button variant="quiet">文字操作</Button>
          <Button disabled>不可用</Button>
          <Button loading loadingLabel="处理中">
            保存
          </Button>
          <Button aria-pressed>已选择</Button>
          <Button aria-invalid variant="danger">
            检查失败
          </Button>
        </div>
      </MaterialSurface>
      <MaterialSurface tone="surface">
        <label htmlFor="material-name" className="text-sm">
          项目名称
        </label>
        <Input
          id="material-name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <label htmlFor="material-error" className="text-sm">
          必填字段
        </label>
        <Input
          id="material-error"
          aria-invalid
          aria-describedby="material-error-text"
        />
        <p id="material-error-text" className="text-sm text-destructive">
          请填写此字段。
        </p>
      </MaterialSurface>
      <MaterialSurface>
        <h2 className="mb-3 font-semibold">可搜索选择器</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ComboboxField
            label="目标团队"
            searchLabel="搜索团队"
            emptyMessage="没有匹配的团队"
            value={destination}
            options={destinations}
            onValueChange={setDestination}
          />
          <ComboboxField
            label="只读选择"
            searchLabel="搜索只读团队"
            emptyMessage="没有匹配的团队"
            readOnly
            value={destination}
            options={destinations}
            onValueChange={setDestination}
          />
          <ComboboxField
            label="禁用选择"
            searchLabel="搜索禁用团队"
            emptyMessage="没有匹配的团队"
            disabled
            value={destination}
            options={destinations}
            onValueChange={setDestination}
          />
          <ComboboxField
            label="加载选项"
            searchLabel="搜索加载中的团队"
            emptyMessage="没有匹配的团队"
            loading
            value={destination}
            options={destinations}
            onValueChange={setDestination}
          />
          <div>
            <ComboboxField
              label="必填团队"
              searchLabel="搜索必填团队"
              emptyMessage="没有匹配的团队"
              required
              invalid
              descriptionId="combo-example-error"
              value=""
              options={destinations}
              onValueChange={setDestination}
            />
            <p
              id="combo-example-error"
              className="mt-2 text-sm text-destructive"
            >
              请选择一个可用团队。
            </p>
          </div>
          <ComboboxField
            label="空选项"
            placeholder="暂无可用团队"
            searchLabel="搜索空列表"
            emptyMessage="没有匹配的团队"
            value=""
            options={[]}
            onValueChange={setDestination}
          />
        </div>
      </MaterialSurface>
      <ProjectWingMasterDataGrid
        columns={columns}
        data={mode === "all" ? rows : rows.slice(1)}
        emptyMessage="暂无记录"
        title="企业数据表"
        tableLabel="验证数据表"
        testId="material-table"
        getRowId={(row) => row.id}
      />
      <MaterialSurface tone="high">
        <h2 className="font-semibold">选择与输入</h2>
        <Button variant="outline" onClick={() => setOpen(true)}>
          打开底部面板
        </Button>
      </MaterialSurface>
      <ProjectWingMasterDataGrid
        columns={columns}
        data={emptyFilter ? [] : rows}
        content={
          emptyFilter ? (
            <CollectionState
              kind="filtered"
              locale="zh-CN"
              action={{
                label: "清除筛选",
                onClick: () => setEmptyFilter(false),
              }}
            />
          ) : undefined
        }
        title="空列表与恢复操作"
        tableLabel="空状态验证"
        testId="material-empty-table"
        getRowId={(row: { id: string }) => row.id}
        emptyMessage="暂无记录"
      />
      <FloatingActionButton
        label="新建演示记录"
        icon={<Plus />}
        extended
        onClick={() => setOpen(true)}
      />
      <MaterialSurface>
        <h2 className="font-semibold">响应式对话框与选择</h2>
        <Button variant="outline" onClick={() => setAdaptiveOpen(true)}>
          打开响应式对话框
        </Button>
        <Dialog open={adaptiveOpen} onOpenChange={setAdaptiveOpen}>
          <DialogContent render={<ResponsiveDialogSurface />}>
            <DialogHeader>
              <DialogTitle>编辑示例</DialogTitle>
            </DialogHeader>
            <label htmlFor="adaptive-name">名称</label>
            <Input
              id="adaptive-name"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <Select
              value={category}
              onValueChange={(next) => next && setCategory(next)}
            >
              <SelectTrigger aria-label="示例分类">
                <SelectValue>
                  {category === "all"
                    ? "全部"
                    : "较长的分类名称，用于检查窄屏换行与选择状态"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent mobilePresentation="sheet">
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="long">
                  较长的分类名称，用于检查窄屏换行与选择状态
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setAdaptiveOpen(false)}>完成</Button>
          </DialogContent>
        </Dialog>
      </MaterialSurface>
      <MobileActionSheet
        open={open}
        onOpenChange={setOpen}
        title="编辑记录"
        closeLabel="关闭面板"
      >
        <label htmlFor="material-sheet-name">名称</label>
        <Input
          id="material-sheet-name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          onClick={() => {
            setOpen(false);
            projectWingToast.success("演示内容已保留");
          }}
        >
          完成
        </Button>
      </MobileActionSheet>
      <ProjectWingToaster />
    </main>
  );
}
