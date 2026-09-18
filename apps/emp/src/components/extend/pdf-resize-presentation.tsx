"use client";

import {
  useViewportCapability,
  useViewportElement,
} from "@embedpdf/plugin-viewport/react";
import { ZoomMode } from "@embedpdf/plugin-zoom";
import type { ZoomScope } from "@embedpdf/plugin-zoom";
import { useZoom } from "@embedpdf/plugin-zoom/react";
import * as React from "react";

const MIN_PRESENTATION_SCALE_DELTA = 0.001;

export type PdfResizePresentation = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type PdfResizePresentationInput = {
  availableWidth: number;
  baseZoom: number;
  contentWidth: number;
  contentInset: number;
  offsetLeft: number;
  offsetTop: number;
  maxZoom: number;
  minZoom: number;
  scrollTop: number;
};

export function getPdfResizePresentation({
  availableWidth,
  baseZoom,
  contentWidth,
  contentInset,
  maxZoom,
  minZoom,
  offsetLeft,
  offsetTop,
  scrollTop,
}: PdfResizePresentationInput): PdfResizePresentation | null {
  if (availableWidth <= 0 || baseZoom <= 0 || contentWidth <= 0) {
    return null;
  }

  const targetZoom = Math.min(
    maxZoom,
    Math.max(minZoom, availableWidth / contentWidth)
  );
  const scale = targetZoom / baseZoom;
  if (!Number.isFinite(scale)) {
    return null;
  }
  const visualWidth = contentWidth * targetZoom;
  const desiredLeft =
    contentInset + Math.max(0, (availableWidth - visualWidth) / 2);

  return {
    scale,
    translateX: desiredLeft - offsetLeft,
    translateY: (scrollTop - offsetTop) * (1 - scale),
  };
}

function getAvailableWidth(viewport: HTMLDivElement, viewportGap: number) {
  return Math.max(0, viewport.clientWidth - viewportGap * 2);
}

function clearPresentation(element: HTMLDivElement | null) {
  if (!element) {
    return;
  }

  element.style.removeProperty("pointer-events");
  element.style.removeProperty("transform");
  element.style.removeProperty("transform-origin");
  element.style.removeProperty("will-change");
  delete element.dataset.pdfResizePresentation;
}

function applyPresentation(
  element: HTMLDivElement | null,
  presentation: PdfResizePresentation
) {
  if (!element) {
    return;
  }

  const { scale, translateX, translateY } = presentation;
  if (Math.abs(scale - 1) < MIN_PRESENTATION_SCALE_DELTA) {
    clearPresentation(element);
    return;
  }

  element.style.pointerEvents = "none";
  element.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
  element.style.transformOrigin = "top left";
  element.style.willChange = "transform";
  element.dataset.pdfResizePresentation = scale.toFixed(4);
}

type PdfResizeMetrics = {
  baseZoom: number;
  contentWidth: number;
  documentId: string;
};

type PdfResizePresentationControllerOptions = {
  documentId: string;
  maxZoom: number;
  metrics: PdfResizeMetrics;
  minZoom: number;
  presentationRef: React.RefObject<HTMLDivElement | null>;
  viewport: HTMLDivElement;
  viewportGap: number;
  zoom: ZoomScope;
};

class PdfResizePresentationController {
  private frame = 0;
  private readonly presentationResizeObserver: ResizeObserver;
  private readonly viewportResizeObserver: ResizeObserver;
  private unsubscribeZoom: () => void = () => {};

  constructor(
    private readonly options: PdfResizePresentationControllerOptions
  ) {
    this.scheduleUpdate = this.scheduleUpdate.bind(this);
    this.syncLayout = this.syncLayout.bind(this);
    this.viewportResizeObserver = new ResizeObserver(this.syncLayout);
    this.presentationResizeObserver = new ResizeObserver(this.syncLayout);
  }

  start() {
    const { presentationRef, viewport, zoom } = this.options;
    this.unsubscribeZoom = zoom.onZoomChange(this.scheduleUpdate);
    this.viewportResizeObserver.observe(viewport);
    if (presentationRef.current) {
      this.presentationResizeObserver.observe(presentationRef.current);
    }
    viewport.addEventListener("scroll", this.scheduleUpdate, { passive: true });
    return () => this.dispose();
  }

  private dispose() {
    const { presentationRef, viewport } = this.options;
    window.cancelAnimationFrame(this.frame);
    this.viewportResizeObserver.disconnect();
    this.presentationResizeObserver.disconnect();
    this.unsubscribeZoom();
    viewport.removeEventListener("scroll", this.scheduleUpdate);
    viewport.style.removeProperty("overflow-x");
    clearPresentation(presentationRef.current);
  }

  private measure() {
    const { documentId, maxZoom, metrics, minZoom, presentationRef, viewport } =
      this.options;
    const element = presentationRef.current;
    if (metrics.documentId !== documentId || metrics.contentWidth <= 0) {
      const baseZoom = this.options.zoom.getState().currentZoomLevel;
      metrics.baseZoom = baseZoom;
      metrics.contentWidth = element ? element.offsetWidth / baseZoom : 0;
      metrics.documentId = documentId;
    } else if (element) {
      metrics.baseZoom = element.offsetWidth / metrics.contentWidth;
    }
    return getPdfResizePresentation({
      availableWidth: getAvailableWidth(viewport, this.options.viewportGap),
      baseZoom: metrics.baseZoom,
      contentInset: this.options.viewportGap,
      contentWidth: metrics.contentWidth,
      maxZoom,
      minZoom,
      offsetLeft: element?.offsetLeft ?? 0,
      offsetTop: element?.offsetTop ?? 0,
      scrollTop: viewport.scrollTop,
    });
  }

  private reset() {
    const { metrics, presentationRef, viewport, zoom } = this.options;
    metrics.baseZoom = zoom.getState().currentZoomLevel;
    viewport.style.removeProperty("overflow-x");
    clearPresentation(presentationRef.current);
  }

  private update() {
    const { presentationRef, viewport, zoom } = this.options;
    this.frame = 0;
    if (zoom.getState().zoomLevel !== ZoomMode.FitWidth) {
      return this.reset();
    }
    const presentation = this.measure();
    if (
      !presentation ||
      Math.abs(presentation.scale - 1) < MIN_PRESENTATION_SCALE_DELTA
    ) {
      viewport.style.removeProperty("overflow-x");
      clearPresentation(presentationRef.current);
      return;
    }
    viewport.style.overflowX = "hidden";
    applyPresentation(presentationRef.current, presentation);
  }

  private scheduleUpdate() {
    if (this.frame) {
      return;
    }
    this.frame = window.requestAnimationFrame(() => this.update());
  }

  private syncLayout() {
    window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.update();
  }
}

type PDFViewerResizePresentationProps = {
  documentId: string;
  maxZoom: number;
  minZoom: number;
  presentationRef: React.RefObject<HTMLDivElement | null>;
};

export function PDFViewerResizePresentation({
  documentId,
  maxZoom,
  minZoom,
  presentationRef,
}: PDFViewerResizePresentationProps) {
  const viewportElementRef = useViewportElement();
  const { provides: viewportCapability } = useViewportCapability();
  const { provides: zoom } = useZoom(documentId);
  const viewportCapabilityRef = React.useRef(viewportCapability);
  const zoomRef = React.useRef(zoom);
  const metricsRef = React.useRef({
    baseZoom: 0,
    contentWidth: 0,
    documentId,
  });
  React.useEffect(() => {
    viewportCapabilityRef.current = viewportCapability;
    zoomRef.current = zoom;
  }, [viewportCapability, zoom]);
  const viewportCapabilityReady = Boolean(viewportCapability);
  const zoomReady = Boolean(zoom);

  React.useEffect(() => {
    const viewport = viewportElementRef?.current;
    const zoomScope = zoomRef.current;
    if (!viewport || !zoomScope) {
      return;
    }

    return new PdfResizePresentationController({
      documentId,
      maxZoom,
      metrics: metricsRef.current,
      minZoom,
      presentationRef,
      viewport,
      viewportGap: viewportCapabilityRef.current?.getViewportGap() ?? 0,
      zoom: zoomScope,
    }).start();
  }, [
    documentId,
    maxZoom,
    minZoom,
    presentationRef,
    viewportCapabilityReady,
    viewportElementRef,
    zoomReady,
  ]);

  return null;
}
