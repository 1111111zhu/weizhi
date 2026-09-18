"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GripVertical, Plus, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { api } from "../../api/client";
import type { ConfirmationGeneralLayout } from "../../api/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  getGeneralFieldColSpan,
  moveGeneralLayoutItem,
  swapGeneralLayoutFields,
} from "./confirmation-general-layout";
import type { GeneralLayoutDrag } from "./confirmation-general-layout";

export function useConfirmationGeneralFields() {
  return useQuery({
    queryKey: ["confirmation-general-fields"],
    queryFn: api.confirmationGeneralFields,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 15_000,
  });
}
export function useConfirmationGeneralLayout() {
  return useQuery({
    queryKey: ["confirmation-general-layout"],
    queryFn: api.confirmationGeneralLayout,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 15_000,
  });
}

function itemKey(element: HTMLElement) {
  const key = element.dataset.layoutField ?? element.dataset.layoutSection;
  if (!key) {
    throw new Error("Layout elements require an identifier");
  }
  return key;
}

export function ConfirmationGeneralInformationSettings({
  locale,
  onBack,
}: {
  locale: string;
  onBack: () => void;
}) {
  const zh = locale.startsWith("zh");
  const queryClient = useQueryClient();
  const layout = useConfirmationGeneralLayout();
  const [draft, setDraft] = useState<ConfirmationGeneralLayout | null>(null);
  const [preview, setPreview] = useState<ConfirmationGeneralLayout | null>(
    null
  );
  const current = preview ?? draft ?? layout.data;
  const editorRef = useRef<HTMLElement>(null);
  const floatingRef = useRef<HTMLElement | null>(null);
  const positionsRef = useRef(new Map<string, DOMRect>());
  const positionsScrollRef = useRef(0);
  const layoutRectsRef = useRef(new Map<string, DOMRect>());
  const measuredScrollRef = useRef(0);
  const animationsRef = useRef(new Map<HTMLElement, Animation>());
  const layoutElements = useCallback(
    () => [
      ...(editorRef.current?.querySelectorAll<HTMLElement>(
        "[data-layout-section], [data-layout-field]"
      ) ?? []),
    ],
    [editorRef]
  );
  const layoutRect = useCallback(
    (element: HTMLElement) => {
      const rect = layoutRectsRef.current.get(itemKey(element));
      return rect
        ? new DOMRect(
            rect.x,
            rect.y -
              ((editorRef.current?.scrollTop ?? 0) - measuredScrollRef.current),
            rect.width,
            rect.height
          )
        : element.getBoundingClientRect();
    },
    [editorRef, layoutRectsRef, measuredScrollRef]
  );
  const capturePositions = useCallback(() => {
    positionsScrollRef.current = editorRef.current?.scrollTop ?? 0;
    positionsRef.current = new Map(
      layoutElements().map((element) => [
        itemKey(element),
        element.getBoundingClientRect(),
      ])
    );
  }, [editorRef, layoutElements, positionsRef, positionsScrollRef]);
  useLayoutEffect(() => {
    const elements = layoutElements();
    animationsRef.current.forEach((animation) => animation.cancel());
    animationsRef.current.clear();
    const next = new Map(
      elements.map((element) => [
        itemKey(element),
        element.getBoundingClientRect(),
      ])
    );
    layoutRectsRef.current = next;
    measuredScrollRef.current = editorRef.current?.scrollTop ?? 0;
    const scrollDelta = measuredScrollRef.current - positionsScrollRef.current;
    // Movement is part of this layout editor's placement feedback.
    {
      for (const element of elements) {
        const before = positionsRef.current.get(itemKey(element));
        const after = next.get(itemKey(element));
        if (!before || !after || !element.animate) {
          continue;
        }
        let x = before.left - after.left;
        let y = before.top - after.top - scrollDelta;
        // Fields inherit their section's movement; animate only their own offset.
        if (element.dataset.layoutField) {
          const parent = element.closest<HTMLElement>("[data-layout-section]");
          const parentBefore =
            parent && positionsRef.current.get(itemKey(parent));
          const parentAfter = parent && next.get(itemKey(parent));
          if (parentBefore && parentAfter) {
            x -= parentBefore.left - parentAfter.left;
            y -= parentBefore.top - parentAfter.top - scrollDelta;
          }
        }
        if (Math.abs(x) + Math.abs(y) < 1) {
          continue;
        }
        animationsRef.current.set(
          element,
          element.animate(
            [
              { transform: `translate(${x}px, ${y}px)` },
              { transform: "translate(0, 0)" },
            ],
            { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          )
        );
      }
    }
    positionsRef.current = next;
    positionsScrollRef.current = measuredScrollRef.current;
  });
  const dragRef = useRef<{
    item: GeneralLayoutDrag;
    original: ConfirmationGeneralLayout;
    preview: ConfirmationGeneralLayout;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    targetKey: string;
    sourceRect: DOMRect;
  } | null>(null);
  const [dragged, setDragged] = useState<GeneralLayoutDrag | null>(null);
  const [notice, setNotice] = useState("");
  const [applied, setApplied] = useState(false);
  const statusRef = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    if (!applied) {
      return;
    }
    const timeout = window.setTimeout(() => {
      statusRef.current?.animate?.([{ opacity: 1 }, { opacity: 0 }], {
        duration: 200,
        easing: "ease-out",
      });
      setApplied(false);
    }, 3200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [applied]);
  const [confirmation, setConfirmation] = useState<{
    message: string;
    action: () => void;
  } | null>(null);
  const save = useMutation({
    mutationFn: api.updateConfirmationGeneralLayout,
    onMutate: () => setApplied(false),
    onSuccess: async (result) => {
      queryClient.setQueryData(["confirmation-general-layout"], result);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["confirmation-general-fields"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-confirmation-defaults"],
        }),
      ]);
      setDraft(null);
      setApplied(true);
    },
  });
  const edit = (next: ConfirmationGeneralLayout) => {
    capturePositions();
    setApplied(false);
    setDraft(next);
    setNotice("");
  };
  const startDrag = (event: ReactPointerEvent, item: GeneralLayoutDrag) => {
    if (save.isPending || !current || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    floatingRef.current?.remove();
    const source = event.currentTarget.closest<HTMLElement>(
      item.kind === "section" ? "[data-layout-section]" : "[data-layout-field]"
    );
    if (!source) {
      return;
    }
    const sourceRect = source.getBoundingClientRect();
    const floating = source.cloneNode(true) as HTMLElement;
    delete floating.dataset.layoutSection;
    delete floating.dataset.layoutField;
    floating
      .querySelectorAll<HTMLElement>(
        "[data-layout-section], [data-layout-field], [id], [aria-label]"
      )
      .forEach((element) => {
        delete element.dataset.layoutSection;
        delete element.dataset.layoutField;
        element.removeAttribute("id");
        element.removeAttribute("aria-label");
      });
    floating.setAttribute("aria-hidden", "true");
    floating.inert = true;
    floating.dataset.dragOverlay = "true";
    Object.assign(floating.style, {
      position: "fixed",
      left: `${sourceRect.left}px`,
      top: `${sourceRect.top}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
      margin: "0",
      pointerEvents: "none",
      zIndex: "100",
      display: "none",
      background: "var(--card)",
      borderColor: "var(--primary)",
      boxShadow: "var(--shadow-xl)",
      transform: "none",
    });
    editorRef.current?.append(floating);
    floatingRef.current = floating;
    capturePositions();
    animationsRef.current.forEach((animation) => animation.cancel());
    layoutRectsRef.current = new Map(
      layoutElements().map((element) => [
        itemKey(element),
        element.getBoundingClientRect(),
      ])
    );
    measuredScrollRef.current = editorRef.current?.scrollTop ?? 0;
    editorRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = {
      item,
      original: current,
      preview: current,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      targetKey: "",
      sourceRect,
    };
  };
  useEffect(() => {
    let frame: number | null = null;
    const activeAnimations = animationsRef.current;
    const nearest = (
      elements: NodeListOf<HTMLElement>,
      x: number,
      y: number
    ) => {
      let closest: HTMLElement | null = null;
      let distance = Infinity;
      for (const element of elements) {
        const rect = layoutRect(element);
        const next = Math.hypot(
          Math.max(rect.left - x, 0, x - rect.right),
          Math.max(rect.top - y, 0, y - rect.bottom)
        );
        if (next < distance) {
          closest = element;
          distance = next;
        }
      }
      return closest;
    };
    const reset = (land = false) => {
      const session = dragRef.current;
      const floating = floatingRef.current;
      floatingRef.current = null;
      capturePositions();
      if (floating && land && session && floating.animate) {
        const target = layoutElements().find(
          (element) => itemKey(element) === session.item.id
        );
        const rect = target && layoutRect(target);
        if (rect) {
          const animation = floating.animate(
            [
              { transform: floating.style.transform, opacity: 1 },
              {
                transform: `translate(${rect.left - session.sourceRect.left}px, ${rect.top - session.sourceRect.top}px)`,
                opacity: 0,
              },
            ],
            {
              duration: 180,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "forwards",
            }
          );
          animation.onfinish = () => floating.remove();
        } else {
          floating.remove();
        }
      } else {
        floating?.remove();
      }
      dragRef.current = null;
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = null;
      if (session && editorRef.current?.hasPointerCapture(session.pointerId)) {
        editorRef.current.releasePointerCapture(session.pointerId);
      }
      setDragged(null);
      setPreview(null);
    };
    const update = (event: PointerEvent) => {
      const session = dragRef.current;
      const editor = editorRef.current;
      if (!session || !editor || event.pointerId !== session.pointerId) {
        return;
      }
      if (
        !session.moved &&
        Math.hypot(
          event.clientX - session.startX,
          event.clientY - session.startY
        ) < 5
      ) {
        return;
      }
      session.moved = true;
      setDragged(session.item);
      if (floatingRef.current) {
        floatingRef.current.style.display = "block";
        floatingRef.current.style.transform = `translate(${event.clientX - session.startX}px, ${event.clientY - session.startY}px)`;
      }
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (!hit || !editor.contains(hit)) {
        return;
      }
      const section = nearest(
        editor.querySelectorAll<HTMLElement>("[data-layout-section]"),
        event.clientX,
        event.clientY
      );
      if (!section) {
        return;
      }
      const sectionId = section.dataset.layoutSection;
      if (!sectionId) {
        return;
      }
      const field =
        session.item.kind === "field"
          ? nearest(
              section.querySelectorAll<HTMLElement>("[data-layout-field]"),
              event.clientX,
              event.clientY
            )
          : null;
      const fieldId = field?.dataset.layoutField;
      if (
        (session.item.kind === "section" && sectionId === session.item.id) ||
        fieldId === session.item.id
      ) {
        return;
      }
      const rect = layoutRect(field ?? section);
      const sourceElement = layoutElements().find(
        (element) => itemKey(element) === session.item.id
      );
      const sourceRect = sourceElement && layoutRect(sourceElement);
      const horizontal =
        field?.dataset.colSpan === "1" &&
        sourceRect &&
        sourceRect.top < rect.bottom &&
        rect.top < sourceRect.bottom &&
        field.parentElement &&
        getComputedStyle(field.parentElement).gridTemplateColumns.split(" ")
          .length > 1;
      const sectionFields =
        session.preview.sections.find((item) => item.id === sectionId)
          ?.fields ?? [];
      const sourceField = sectionFields.find(
        (item) => item.id === session.item.id
      );
      const targetField = sectionFields.find((item) => item.id === fieldId);
      const canSwap =
        session.item.kind === "field" &&
        sourceField &&
        targetField &&
        getGeneralFieldColSpan(sourceField) ===
          getGeneralFieldColSpan(targetField);
      const orderedItems =
        session.item.kind === "section"
          ? session.preview.sections
          : session.preview.sections.flatMap((item) => item.fields);
      const movingForward =
        orderedItems.findIndex((item) => item.id === session.item.id) <
        orderedItems.findIndex((item) => item.id === (fieldId ?? sectionId));
      // Trigger after entering 15% of the next item, in either direction.
      const swapThreshold = movingForward ? 0.15 : 0.85;
      const after =
        event.clientY < rect.top
          ? false
          : event.clientY > rect.bottom
            ? true
            : horizontal
              ? event.clientX > rect.left + rect.width * swapThreshold
              : event.clientY > rect.top + rect.height * swapThreshold;
      if (canSwap && after !== movingForward) {
        return;
      }
      const targetKey = `${sectionId}:${fieldId ?? ""}:${after}`;
      if (targetKey !== session.targetKey) {
        const next =
          canSwap && fieldId
            ? swapGeneralLayoutFields(
                session.preview,
                sectionId,
                session.item.id,
                fieldId
              )
            : moveGeneralLayoutItem(
                session.preview,
                session.item,
                sectionId,
                fieldId,
                after
              );
        session.targetKey = targetKey;
        session.preview = next;
        capturePositions();
        setPreview(next);
      }
    };
    const move = (event: PointerEvent) => {
      if (!dragRef.current || event.pointerId !== dragRef.current.pointerId) {
        return;
      }
      event.preventDefault();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        frame = null;
        update(event);
      });
      const editor = editorRef.current;
      if (editor) {
        const rect = editor.getBoundingClientRect();
        if (event.clientY < rect.top + 48) {
          editor.scrollTop -= 18;
        } else if (event.clientY > rect.bottom - 48) {
          editor.scrollTop += 18;
        }
      }
    };
    const finish = (event: PointerEvent) => {
      const session = dragRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (
        session.moved &&
        hit &&
        editorRef.current?.contains(hit) &&
        session.preview !== session.original
      ) {
        setDraft(session.preview);
        setApplied(false);
        setNotice("");
      }
      reset(Boolean(session.moved && hit && editorRef.current?.contains(hit)));
    };
    const cancel = () => reset();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dragRef.current) {
        event.preventDefault();
        reset();
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", cancel);
    return () => {
      floatingRef.current?.remove();
      activeAnimations.forEach((animation) => animation.cancel());
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("blur", cancel);
    };
  }, [
    animationsRef,
    capturePositions,
    layoutElements,
    layoutRect,
    dragRef,
    editorRef,
    floatingRef,
  ]);
  const back = () => {
    if (draft) {
      setConfirmation({
        message: zh
          ? "尚未应用的修改将丢弃，确定返回？"
          : "Discard unapplied changes and return?",
        action: onBack,
      });
      return;
    }
    onBack();
  };
  const remove = (kind: string, name: string, action: () => void) => {
    setConfirmation({
      message: zh
        ? `删除${kind}“${name}”？应用后将从所有项目和新关联选项中移除，已有函证内容保留。`
        : `Delete ${name}? After applying, it will be removed from projects and new association options. Existing confirmation content is preserved.`,
      action,
    });
  };
  return (
    <section
      ref={editorRef}
      className={`h-full min-h-0 overflow-y-auto bg-background p-6 ${save.isPending ? "[&_button:disabled]:opacity-100" : ""}`}
      aria-label={zh ? "通用信息设置" : "General information settings"}
    >
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-border pb-5">
          <div className="contents">
            <Button
              className="col-span-2 justify-self-start"
              variant="ghost"
              size="sm"
              disabled={save.isPending}
              onClick={back}
            >
              <ArrowLeft />
              {zh ? "返回函证模板库" : "Back to template library"}
            </Button>
            <h1 className="text-xl font-semibold tracking-tight">
              {zh ? "通用信息设置" : "General information settings"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <output
              ref={statusRef}
              aria-hidden={!applied}
              className={`pointer-events-none text-right text-sm text-primary transition-opacity duration-200 ${applied ? "opacity-100" : "opacity-0"}`}
            >
              {zh
                ? "已成功应用到所有项目。"
                : "Successfully applied to all projects."}
            </output>
            <Button
              className="grid"
              accessibleName={zh ? "确定并应用全局" : "Apply globally"}
              aria-busy={save.isPending}
              disabled={
                !current || save.isPending || layout.isError || dragged !== null
              }
              onClick={() => {
                if (!current) {
                  return;
                }
                if (
                  current.sections.some(
                    (section) =>
                      !section.name.trim() ||
                      section.fields.some((field) => !field.name.trim())
                  )
                ) {
                  setNotice(
                    zh
                      ? "请填写所有板块和字段名称。"
                      : "Enter all section and field names."
                  );
                  return;
                }
                save.mutate({
                  sections: current.sections.map((section) => ({
                    ...section,
                    name: section.name.trim(),
                    fields: section.fields.map((field) => ({
                      ...field,
                      name: field.name.trim(),
                    })),
                  })),
                });
              }}
            >
              <span
                className={`col-start-1 row-start-1 ${save.isPending ? "invisible" : ""}`}
              >
                {zh ? "确定并应用全局" : "Apply globally"}
              </span>
              <span
                aria-hidden="true"
                className={`col-start-1 row-start-1 ${save.isPending ? "" : "invisible"}`}
              >
                {zh ? "正在应用…" : "Applying…"}
              </span>
            </Button>
          </div>
        </header>
        {layout.isPending && <p>{zh ? "正在加载…" : "Loading…"}</p>}
        {(layout.isError || save.isError || notice) && (
          <p role="alert" className="text-destructive">
            {notice || save.error?.message || layout.error?.message}
          </p>
        )}
        {current?.sections.map((section, sectionIndex) => (
          <section
            key={section.id}
            data-layout-section={section.id}
            className={`relative rounded-xl border border-border/70 bg-card p-5 shadow-sm ${dragged?.kind === "section" && dragged.id === section.id ? "invisible" : ""}`}
          >
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-grab touch-none select-none active:cursor-grabbing"
                disabled={save.isPending}
                aria-label={`${zh ? "拖动板块" : "Drag section"}: ${section.name}`}
                title={zh ? "拖动调整板块顺序" : "Drag to reorder sections"}
                onPointerDown={(event) =>
                  startDrag(event, { kind: "section", id: section.id })
                }
              >
                <GripVertical />
              </Button>
              <Input
                className="mr-auto max-w-md font-medium"
                aria-label={`${zh ? "板块名称" : "Section name"} ${sectionIndex + 1}`}
                maxLength={100}
                value={section.name}
                readOnly={save.isPending}
                onChange={(event) =>
                  edit({
                    sections: current.sections.map((item) =>
                      item.id === section.id
                        ? { ...item, name: event.target.value }
                        : item
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={save.isPending}
                onClick={() =>
                  remove(zh ? "板块" : "section", section.name, () =>
                    edit({
                      sections: current.sections.filter(
                        (item) => item.id !== section.id
                      ),
                    })
                  )
                }
              >
                <Trash2 />
                {zh ? "删除板块" : "Delete section"}
              </Button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {section.fields.length === 0 && (
                <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground md:col-span-2">
                  {zh
                    ? "将字段拖到这里，或新增字段"
                    : "Drop a field here, or add a field"}
                </p>
              )}
              {section.fields.map((field, fieldIndex) => (
                <div
                  key={field.id}
                  data-layout-field={field.id}
                  data-col-span={getGeneralFieldColSpan(field)}
                  className={`relative min-w-0 space-y-2 rounded-lg border border-border/60 p-3 ${getGeneralFieldColSpan(field) === 2 ? "md:col-span-2" : ""} ${dragged?.kind === "field" && dragged.id === field.id ? "invisible" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="cursor-grab touch-none select-none active:cursor-grabbing"
                      disabled={save.isPending}
                      aria-label={`${zh ? "拖动字段" : "Drag field"}: ${field.name}`}
                      title={zh ? "拖动调整字段位置" : "Drag to move field"}
                      onPointerDown={(event) =>
                        startDrag(event, { kind: "field", id: field.id })
                      }
                    >
                      <GripVertical />
                    </Button>
                    <Input
                      aria-label={`${zh ? "字段名称" : "Field name"} ${sectionIndex + 1}-${fieldIndex + 1}`}
                      value={field.name}
                      maxLength={100}
                      readOnly={save.isPending}
                      onChange={(event) =>
                        edit({
                          sections: current.sections.map((item) =>
                            item.id === section.id
                              ? {
                                  ...item,
                                  fields: item.fields.map((value) =>
                                    value.id === field.id
                                      ? { ...value, name: event.target.value }
                                      : value
                                  ),
                                }
                              : item
                          ),
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${zh ? "删除字段" : "Delete field"} ${field.name}`}
                      disabled={save.isPending}
                      onClick={() =>
                        remove(zh ? "字段" : "field", field.name, () =>
                          edit({
                            sections: current.sections.map((item) =>
                              item.id === section.id
                                ? {
                                    ...item,
                                    fields: item.fields.filter(
                                      (value) => value.id !== field.id
                                    ),
                                  }
                                : item
                            ),
                          })
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <fieldset
                    className="flex items-center gap-1 text-xs"
                    aria-label={`${field.name} ${zh ? "字段宽度" : "field width"}`}
                  >
                    <span className="mr-1 text-muted-foreground">
                      {zh ? "占位" : "Width"}
                    </span>
                    {([1, 2] as const).map((colSpan) => (
                      <Button
                        key={colSpan}
                        type="button"
                        size="xs"
                        variant={
                          getGeneralFieldColSpan(field) === colSpan
                            ? "secondary"
                            : "ghost"
                        }
                        aria-pressed={getGeneralFieldColSpan(field) === colSpan}
                        disabled={save.isPending}
                        onClick={() =>
                          edit({
                            sections: current.sections.map((item) => ({
                              ...item,
                              fields: item.fields.map((value) =>
                                value.id === field.id
                                  ? { ...value, colSpan }
                                  : value
                              ),
                            })),
                          })
                        }
                      >
                        {colSpan === 2
                          ? zh
                            ? "整行 · 100%"
                            : "Full · 100%"
                          : zh
                            ? "半行 · 50%"
                            : "Half · 50%"}
                      </Button>
                    ))}
                  </fieldset>
                  <Input
                    disabled
                    placeholder={
                      zh
                        ? "各项目在此填写内容"
                        : "Values are entered in each project"
                    }
                    aria-label={`${field.name} ${zh ? "填写预览" : "preview"}`}
                  />
                </div>
              ))}
            </div>
            <Button
              className="mt-4"
              variant="outline"
              size="sm"
              disabled={
                save.isPending ||
                current.sections.reduce(
                  (sum, item) => sum + item.fields.length,
                  0
                ) >= 200
              }
              onClick={() =>
                edit({
                  sections: current.sections.map((item) =>
                    item.id === section.id
                      ? {
                          ...item,
                          fields: [
                            ...item.fields,
                            { id: crypto.randomUUID(), name: "", colSpan: 1 },
                          ],
                        }
                      : item
                  ),
                })
              }
            >
              <Plus />
              {zh ? "新增字段" : "Add field"}
            </Button>
          </section>
        ))}
        {current && (
          <Button
            className="w-full border-dashed"
            variant="outline"
            disabled={save.isPending || current.sections.length >= 30}
            onClick={() =>
              edit({
                sections: [
                  ...current.sections,
                  { id: crypto.randomUUID(), name: "", fields: [] },
                ],
              })
            }
          >
            <Plus />
            {zh ? "新增板块" : "Add section"}
          </Button>
        )}
      </div>
      {confirmation && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setConfirmation(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {zh ? "确认操作" : "Confirm action"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmation.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{zh ? "取消" : "Cancel"}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  confirmation.action();
                  setConfirmation(null);
                }}
              >
                {zh ? "确定" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}
