"use client";

import {
  Button,
  Input,
  GuidedForm,
  GuidedFormIntro,
  GuidedFormEntryActions,
  GuidedFormSection,
  GuidedFormField,
  GuidedFormChoices,
  GuidedFormSelect,
  GuidedFormSummary,
  MobileListItem,
  CollectionState,
} from "@project-wing/ui";
import {
  BriefcaseBusiness,
  FilePlus2,
  FileClock,
  FolderKanban,
  Plus,
  Zap,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  filterProjectCreationBusinesses,
  mobileCreationHash,
  projectCreationBusinesses,
} from "./mobile-project-creation-model";
import type { MobileCreationStage } from "./mobile-project-creation-model";
import { SpecimenSection } from "./specimen-section";

const sourceOptions = [
  {
    value: "CMP",
    label: "从 CMP 业务创建",
    annotation: "推荐",
    description: "关联正式客户与业务资料，适合标准承接流程。",
    icon: <BriefcaseBusiness />,
  },
  {
    value: "QUICK",
    label: "快速创建",
    description: "无需预先录入客户，先建立项目并在后续补充关联。",
    icon: <FilePlus2 />,
  },
];
const initializationOptions = [
  { value: "BLANK", label: "空白项目", icon: <FilePlus2 /> },
  { value: "TEMPLATE", label: "使用项目模板", icon: <FolderKanban /> },
  { value: "ROLL_FORWARD", label: "结转历史项目", icon: <FileClock /> },
];
const templates = [
  { value: "SME", label: "SME 模版", code: "AUD_TEMPLATE1" },
  { value: "HK02", label: "hkfrs", code: "hk02" },
];
const projects = [
  { value: "JAGO", label: "Jago Trade Limited", code: "J836AUD202610101" },
  { value: "ARC", label: "ARCHIVE_TEST", code: "TEST_ARC" },
];
const templateSearch = {
  placeholder: "搜索模板名称或编号",
  groupLabel: "项目模板",
  emptyLabel: "未找到匹配的项目模板",
  clearLabel: "清空模板搜索",
  clearSelectionLabel: "清除已选模板",
};
const projectSearch = {
  placeholder: "搜索项目名称或编号",
  groupLabel: "已归档项目",
  emptyLabel: "未找到匹配的已归档项目",
  clearLabel: "清空项目搜索",
  clearSelectionLabel: "清除已选项目",
};
const businessSearch = {
  placeholder: "搜索业务名称或编号",
  groupLabel: "CMP 业务",
  showGroupLabel: false,
  emptyLabel: "未找到匹配的 CMP 业务",
  clearLabel: "清空业务搜索",
  clearSelectionLabel: "清除已选业务",
};
const source = {
  scope: "shared" as const,
  library: "@project-wing/ui",
  detail: "GuidedForm family · Ready · EMP project creation approved",
};

export function ProjectCreationComposition({
  mobile = false,
  mobileStage = "source",
  onMobileStageChange,
  onMobileBack,
}: {
  mobile?: boolean;
  mobileStage?: MobileCreationStage;
  onMobileStageChange?: (stage: MobileCreationStage) => void;
  onMobileBack?: () => void;
} = {}) {
  const [desktopStep, setDesktopStep] = useState("source");
  const step = mobile
    ? mobileStage === "review"
      ? "setup"
      : mobileStage
    : desktopStep;
  const setStep = (next: string) => {
    if (mobile) {
      onMobileStageChange?.(next === "setup" ? "setup" : "source");
    } else {
      setDesktopStep(next);
    }
  };
  const [creationSource, setCreationSource] = useState("CMP");
  const [business, setBusiness] = useState("");
  const [initialization, setInitialization] = useState("TEMPLATE");
  const [template, setTemplate] = useState("");
  const [priorProject, setPriorProject] = useState("");
  const [language, setLanguage] = useState("zh-CN");
  const [name, setName] = useState("");
  const [standard, setStandard] = useState("");
  const [desktopReviewing, setDesktopReviewing] = useState(false);
  const reviewing = mobile ? mobileStage === "review" : desktopReviewing;
  const setReviewing = (value: boolean) => {
    if (mobile) {
      onMobileStageChange?.(value ? "review" : "setup");
    } else {
      setDesktopReviewing(value);
    }
  };
  const [businessQuery, setBusinessQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [yearEnd, setYearEnd] = useState("2026-12-31");
  const [reportDate, setReportDate] = useState("2027-03-31");
  const [archiveDate, setArchiveDate] = useState("2027-05-30");
  const sourceLabel =
    sourceOptions.find((item) => item.value === creationSource)?.label ?? "";
  const summary = [
    { label: "项目来源", value: sourceLabel },
    {
      label: "客户",
      value:
        creationSource === "QUICK"
          ? "未关联客户及 CMP 业务"
          : business
            ? business === "orchid"
              ? "Orchid Technology Limited"
              : "Harbour Retail Limited"
            : "未选择 CMP 业务",
    },
    {
      label: "初始化方式",
      value:
        initializationOptions.find((item) => item.value === initialization)
          ?.label ?? "",
    },
    { label: "初始成员邀请", value: "0" },
  ];
  if (mobile && mobileStage === "source") {
    return (
      <div className="grid">
        <MobileListItem
          title="从已有业务创建"
          description="选择客户及 CMP 业务"
          icon={<BriefcaseBusiness />}
          href={mobileCreationHash("business")}
          onNavigate={(event) => {
            event.preventDefault();
            setCreationSource("CMP");
            onMobileStageChange?.("business");
          }}
        />
        <MobileListItem
          title="直接创建项目"
          description="稍后关联客户和业务"
          icon={<FilePlus2 />}
          href={mobileCreationHash("setup")}
          onNavigate={(event) => {
            event.preventDefault();
            setCreationSource("QUICK");
            setStep("setup");
          }}
        />
      </div>
    );
  }
  if (mobile && mobileStage === "business") {
    const matches = filterProjectCreationBusinesses(businessQuery);
    return (
      <div className="grid gap-4">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="搜索已有业务"
            placeholder="业务编号或客户名称"
            className="pl-9"
            value={businessQuery}
            onChange={(event) => setBusinessQuery(event.target.value)}
          />
        </div>
        {matches.length ? (
          <div className="grid">
            {matches.map((item) => (
              <MobileListItem
                key={item.value}
                title={item.label}
                description={item.code}
                meta={business === item.value ? "已选择" : undefined}
                icon={<BriefcaseBusiness />}
                href={mobileCreationHash("setup")}
                onNavigate={(event) => {
                  event.preventDefault();
                  setBusiness(item.value);
                  setCreationSource("CMP");
                  setStep("setup");
                }}
              />
            ))}
          </div>
        ) : (
          <CollectionState
            kind="filtered"
            locale="zh-CN"
            action={{ label: "清除搜索", onClick: () => setBusinessQuery("") }}
          />
        )}
      </div>
    );
  }
  if (step === "source") {
    return (
      <GuidedFormIntro
        title={mobile ? "项目来源" : "Jony Ma，欢迎回来"}
        description={
          mobile ? undefined : "选择适合当前工作的方式，开始创建项目。"
        }
        choices={
          <GuidedFormEntryActions
            label="创建模式"
            onAction={(next) => {
              setCreationSource(next);
              if (next === "QUICK") {
                setBusiness("");
                if (!name.trim()) {
                  setName("Dummy");
                }
                setStep("setup");
              } else {
                document
                  .querySelector<HTMLInputElement>("#proposal-engagement")
                  ?.focus();
              }
            }}
            options={[
              {
                value: "CMP",
                label: "常规模式",
                description: "关联客户与 CMP 业务",
                icon: <BriefcaseBusiness />,
              },
              {
                value: "QUICK",
                label: "快速模式",
                description: "先创建项目，稍后补充关联",
                icon: <Zap />,
              },
            ]}
          />
        }
      >
        {creationSource === "CMP" ? (
          <GuidedFormSelect
            id="proposal-engagement"
            value={business}
            onValueChange={(next) => {
              setBusiness(next);
              if (next) {
                setCreationSource("CMP");
                setStep("setup");
              }
            }}
            placeholder="搜索业务编号、客户编号或客户名称"
            search={{
              ...businessSearch,
              placeholder: "搜索业务编号、客户编号或客户名称",
            }}
            icon={<BriefcaseBusiness />}
            options={projectCreationBusinesses}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            无需关联业务。进入下一步填写项目资料，之后仍可补充关联。
          </p>
        )}
      </GuidedFormIntro>
    );
  }
  return (
    <>
      <GuidedForm
        label="创建项目"
        appearance="grouped"
        steps={[
          { id: "source", label: "项目来源", completed: step === "setup" },
          { id: "setup", label: "项目设置" },
        ]}
        value={step}
        onValueChange={(value) => {
          if (value === "source" && !mobile) {
            setCreationSource("CMP");
          }
          setStep(value);
          if (!mobile) {
            setReviewing(false);
          }
        }}
        aside={
          step === "setup" && !reviewing ? (
            <GuidedFormSummary
              title="创建摘要"
              status="待完善"
              items={summary}
            />
          ) : undefined
        }
        actions={
          <>
            {step === "setup" ? (
              <Button
                variant="outline"
                onClick={() => {
                  if (mobile) {
                    onMobileBack?.();
                  } else if (reviewing) {
                    setReviewing(false);
                  } else {
                    setCreationSource("CMP");
                    setStep("source");
                  }
                }}
              >
                {reviewing ? "返回编辑" : "上一步"}
              </Button>
            ) : null}
            <Button
              onClick={() => {
                if (step === "source") {
                  setStep("setup");
                } else if (reviewing) {
                  setNotice(
                    mobile
                      ? "当前无法创建项目，未保存项目或发送邀请。"
                      : "这是视觉预览，未创建项目，也未发送邀请。"
                  );
                } else {
                  setReviewing(true);
                }
              }}
            >
              {step === "source"
                ? "下一步"
                : reviewing
                  ? "确认创建"
                  : "复核并创建"}
            </Button>
          </>
        }
      >
        {reviewing ? (
          <div className="grid items-start gap-x-8 @3xl:grid-cols-2">
            <GuidedFormSection title="项目资料" columns={1}>
              {[
                { label: "项目名称", value: name || "—" },
                ...summary,
                { label: "适用会计准则", value: standard || "—" },
              ].map((item) => (
                <dl
                  key={item.label}
                  className="grid min-w-0 gap-2 @sm:grid-cols-2 @sm:gap-6"
                >
                  <dt className="text-sm text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="min-w-0 text-base font-medium break-words">
                    {item.value}
                  </dd>
                </dl>
              ))}
            </GuidedFormSection>
            <GuidedFormSection title="重要日期" columns={1}>
              {[
                { label: "年末日期", value: yearEnd },
                { label: "报告日期", value: reportDate },
                { label: "归档截止日", value: archiveDate },
              ].map((item) => (
                <dl
                  key={item.label}
                  className="grid min-w-0 gap-2 @sm:grid-cols-2 @sm:gap-6"
                >
                  <dt className="text-sm text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="min-w-0 text-base font-medium break-words">
                    {item.value}
                  </dd>
                </dl>
              ))}
            </GuidedFormSection>
          </div>
        ) : (
          <>
            <GuidedFormSection title={mobile ? "基本信息" : "项目设置"}>
              <GuidedFormField
                id="proposal-name"
                label="项目名称"
                required
                span="full"
                description={
                  creationSource === "QUICK"
                    ? "未关联 Engagement；项目代码将在创建时自动生成。"
                    : undefined
                }
              >
                {(control) => (
                  <Input
                    {...control}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                )}
              </GuidedFormField>
              <GuidedFormField id="proposal-language" label="显示语言">
                {(control) => (
                  <GuidedFormSelect
                    {...control}
                    value={language}
                    onValueChange={setLanguage}
                    placeholder="选择语言"
                    options={[
                      { value: "zh-CN", label: "简体中文" },
                      { value: "en-US", label: "English" },
                    ]}
                  />
                )}
              </GuidedFormField>
              <GuidedFormField
                id="proposal-standard"
                label="适用会计准则"
                required
              >
                {(control) => (
                  <Input
                    {...control}
                    value={standard}
                    onChange={(event) => setStandard(event.target.value)}
                    placeholder="例如 HKFRS、IFRS、CAS"
                  />
                )}
              </GuidedFormField>
            </GuidedFormSection>
            <GuidedFormSection title="初始化方式" columns={1}>
              <GuidedFormChoices
                label="初始化方式"
                layout="inline"
                value={initialization}
                onValueChange={setInitialization}
                options={initializationOptions}
              />
              {initialization === "TEMPLATE" ? (
                <GuidedFormField
                  id="proposal-template"
                  label="项目模板"
                  required
                >
                  {(control) => (
                    <GuidedFormSelect
                      {...control}
                      value={template}
                      onValueChange={setTemplate}
                      options={templates}
                      search={templateSearch}
                      placeholder="请选择项目模板"
                      icon={<FolderKanban />}
                    />
                  )}
                </GuidedFormField>
              ) : initialization === "ROLL_FORWARD" ? (
                <GuidedFormField
                  id="proposal-prior-project"
                  label="已归档来源项目"
                  required
                >
                  {(control) => (
                    <GuidedFormSelect
                      {...control}
                      value={priorProject}
                      onValueChange={setPriorProject}
                      options={projects}
                      search={projectSearch}
                      placeholder="搜索已归档项目"
                      icon={<FileClock />}
                    />
                  )}
                </GuidedFormField>
              ) : (
                <p className="text-sm text-muted-foreground">
                  不套用项目模板，也不继承历史项目；系统只创建基础工作流目录。
                </p>
              )}
            </GuidedFormSection>
            <GuidedFormSection title="重要日期" columns={3}>
              <GuidedFormField id="proposal-year-end" label="年末日期" required>
                {(control) => (
                  <Input
                    {...control}
                    type="date"
                    value={yearEnd}
                    onChange={(event) => setYearEnd(event.target.value)}
                  />
                )}
              </GuidedFormField>
              <GuidedFormField
                id="proposal-report-date"
                label="报告日期"
                required
              >
                {(control) => (
                  <Input
                    {...control}
                    type="date"
                    value={reportDate}
                    onChange={(event) => setReportDate(event.target.value)}
                  />
                )}
              </GuidedFormField>
              <GuidedFormField
                id="proposal-archive-date"
                label="归档截止日"
                required
              >
                {(control) => (
                  <Input
                    {...control}
                    type="date"
                    value={archiveDate}
                    onChange={(event) => setArchiveDate(event.target.value)}
                  />
                )}
              </GuidedFormField>
            </GuidedFormSection>
            <GuidedFormSection title="初始成员邀请" columns={1}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  尚未选择被邀请人员。项目创建后仍可继续邀请。
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    setNotice(
                      "成员邀请沿用现有弹窗和权限逻辑；此预览不会发送邀请。"
                    )
                  }
                >
                  <Plus />
                  邀请成员
                </Button>
              </div>
            </GuidedFormSection>
          </>
        )}
      </GuidedForm>
      {notice ? (
        <output className="text-sm text-muted-foreground">{notice}</output>
      ) : null}
    </>
  );
}

export function GuidedFormSpecimen() {
  const [dark, setDark] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    return () => {
      root.classList.toggle("dark", wasDark);
    };
  }, [dark]);
  const [choice, setChoice] = useState("CMP");
  const [selected, setSelected] = useState("SME");
  const [stressSelected, setStressSelected] = useState("");
  return (
    <div
      lang="zh-CN"
      className={`${dark ? "dark " : ""}w-full space-y-8 bg-background text-foreground ${narrow ? "max-w-sm" : "max-w-7xl"}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">企业表单 · 视觉提案</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            沿用 ProjectWing 品牌与控件，参考 ServiceNow Horizon
            的表单分组、网格和操作层级。实际项目创建页面已接入；这里保留组件状态与组合预览。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            aria-pressed={narrow}
            onClick={() => setNarrow((value) => !value)}
          >
            {narrow ? "桌面预览" : "窄屏预览"}
          </Button>
          <Button
            variant="outline"
            aria-pressed={dark}
            onClick={() => setDark((value) => !value)}
          >
            {dark ? "浅色预览" : "深色预览"}
          </Button>
        </div>
      </header>
      <nav aria-label="表单提案目录" className="flex flex-wrap gap-5 text-sm">
        <a
          className="text-primary underline underline-offset-4"
          href="#form-fields"
        >
          字段与状态
        </a>
        <a
          className="text-primary underline underline-offset-4"
          href="#form-choices"
        >
          选择模式
        </a>
        <a
          className="text-primary underline underline-offset-4"
          href="#creation-proposal"
        >
          项目创建预览
        </a>
        <Link
          className="text-muted-foreground underline underline-offset-4"
          href="/"
        >
          Showroom 目录
        </Link>
      </nav>
      <SpecimenSection
        id="form-fields"
        title="字段与状态"
        description="统一标签、输入、帮助与错误的位置。保留原有焦点、只读和禁用语义，不以阴影制造层级。"
        source={source}
      >
        <GuidedForm
          label="字段模式预览"
          value="fields"
          steps={[{ id: "fields", label: "表单字段" }]}
          onValueChange={() => {}}
          actions={
            <Button disabled aria-busy>
              保存中…
            </Button>
          }
        >
          <GuidedFormSection title="字段状态">
            <GuidedFormField
              id="state-default"
              label="项目名称"
              required
              description="帮助文字与输入框起点对齐。"
            >
              {(control) => (
                <Input {...control} defaultValue="Orchid Holdings 2026 audit" />
              )}
            </GuidedFormField>
            <GuidedFormField
              id="state-invalid"
              label="适用会计准则"
              required
              error="请输入适用会计准则。"
            >
              {(control) => (
                <Input {...control} placeholder="例如 HKFRS、IFRS、CAS" />
              )}
            </GuidedFormField>
            <GuidedFormField id="state-readonly" label="项目代码（只读）">
              {(control) => (
                <Input {...control} readOnly value="AUD-2026-0001" />
              )}
            </GuidedFormField>
            <GuidedFormField id="state-disabled" label="显示语言（不可用）">
              {(control) => <Input {...control} disabled value="简体中文" />}
            </GuidedFormField>
            <GuidedFormField id="state-select" label="项目模板">
              {(control) => (
                <GuidedFormSelect
                  {...control}
                  options={templates}
                  search={templateSearch}
                  value={selected}
                  onValueChange={setSelected}
                  placeholder="请选择项目模板"
                  icon={<FolderKanban />}
                />
              )}
            </GuidedFormField>
            <GuidedFormField
              id="state-long"
              label="较长的双语名称 / Long bilingual project name"
            >
              {(control) => (
                <Input
                  {...control}
                  defaultValue="Orchid Holdings Limited — 2026 financial statements audit"
                />
              )}
            </GuidedFormField>
            <GuidedFormField
              id="state-select-disabled"
              label="项目模板（不可用）"
            >
              {(control) => (
                <GuidedFormSelect
                  {...control}
                  disabled
                  options={templates}
                  search={templateSearch}
                  value=""
                  onValueChange={setSelected}
                  placeholder="正在读取项目模板…"
                  icon={<FolderKanban />}
                />
              )}
            </GuidedFormField>
            <GuidedFormField
              id="state-search-stress"
              label="搜索列表（长名称与滚动）"
              span="full"
            >
              {(control) => (
                <GuidedFormSelect
                  {...control}
                  value={stressSelected}
                  onValueChange={setStressSelected}
                  placeholder="选择测试项目"
                  icon={<FileClock />}
                  search={projectSearch}
                  options={Array.from({ length: 14 }, (_, index) => ({
                    value: `stress-${index}`,
                    code: `AUD-2026-${String(index + 1).padStart(4, "0")}`,
                    label:
                      index === 0
                        ? "Orchid Holdings International Limited — 2026 financial statements audit / 年度财务报表审计"
                        : `示例归档项目 ${index + 1}${index === 1 ? "（不可用）" : ""}`,
                    disabled: index === 1,
                  }))}
                />
              )}
            </GuidedFormField>
          </GuidedFormSection>
        </GuidedForm>
      </SpecimenSection>
      <SpecimenSection
        id="form-choices"
        title="选择模式"
        description="真实单选语义，选中状态不只依赖颜色。Tab 进入，方向键选择；窄屏自动堆叠，说明不截断。"
        source={source}
      >
        <GuidedFormChoices
          label="创建来源示例"
          value={choice}
          onValueChange={setChoice}
          options={sourceOptions}
        />
        <GuidedFormChoices
          label="不可用示例"
          value="CMP"
          onValueChange={setChoice}
          options={sourceOptions}
          disabled
        />
      </SpecimenSection>
      <SpecimenSection
        id="creation-proposal"
        title="项目创建预览"
        description="已接入实际项目创建页：选择 CMP 业务或点击快速模式即可进入第二页，不再显示下一步。这里使用演示身份和数据；第二页字段和规则保持不变。"
        source={{
          ...source,
          detail: "GuidedFormIntro · Ready · EMP adoption approved",
        }}
      >
        <ProjectCreationComposition />
      </SpecimenSection>
    </div>
  );
}
