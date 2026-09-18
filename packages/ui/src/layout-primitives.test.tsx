// @vitest-environment happy-dom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { Input } from "./input";
import {
  Card,
  Container,
  DescriptionList,
  DetailPageLayout,
  FilterBar,
  FormPageLayout,
  Grid,
  Inline,
  ListPageLayout,
  SectionHeader,
  Stack,
  Surface,
} from "./layout-primitives";

function required<T extends Element>(host: ParentNode, selector: string): T {
  const element = host.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing ${selector}`);
  }
  return element;
}

describe("shared layout native-slot contract", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());

  it("forwards semantic elements and refs without interrupting form submission or focus", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const ref = createRef<HTMLElement>();
    const submitted = vi.fn();
    try {
      act(() =>
        root.render(
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitted(new FormData(event.currentTarget).get("memo"));
            }}
          >
            <Surface
              as="article"
              ref={ref}
              variant="outlined"
              padding="md"
              aria-label="Draft"
            >
              <Container width="full">
                <Stack>
                  <SectionHeader heading="Details" />
                  <FilterBar aria-label="Controls">
                    <Input
                      name="memo"
                      aria-label="Memo"
                      defaultValue="Draft value"
                    />
                  </FilterBar>
                  <Grid columns={2}>
                    <Inline>
                      <Button type="submit">Save</Button>
                    </Inline>
                    <Button disabled>Unavailable</Button>
                  </Grid>
                </Stack>
              </Container>
            </Surface>
          </form>
        )
      );
      expect(ref.current).toBe(host.querySelector("article"));
      expect(ref.current?.getAttribute("aria-label")).toBe("Draft");
      const button = required<HTMLButtonElement>(host, 'button[type="submit"]');
      act(() => button.focus());
      expect(document.activeElement).toBe(button);
      act(() => button.click());
      expect(submitted).toHaveBeenCalledExactlyOnceWith("Draft value");
      expect(
        required<HTMLButtonElement>(host, "button[disabled]").disabled === true
      ).toBeTruthy();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("keeps description values, zeroes and keyed editable content intact when metadata reorders", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const editable = {
      id: "draft",
      label: "Draft",
      value: <Input aria-label="Draft input" defaultValue="Unsaved" />,
    };
    const zero = { id: "count", label: "Count", value: 0 };
    try {
      act(() =>
        root.render(
          <DescriptionList
            items={[
              editable,
              zero,
              { id: "missing", label: "Missing", value: null },
            ]}
            columns={2}
            emptyValue="Not provided"
          />
        )
      );
      const input = required<HTMLInputElement>(host, "input");
      input.value = "Keep this draft";
      act(() => input.dispatchEvent(new Event("input", { bubbles: true })));
      expect(host.querySelectorAll("dd")[1]?.textContent).toBe("0");
      expect(host.querySelectorAll("dd")[2]?.textContent).toBe("Not provided");
      act(() =>
        root.render(<DescriptionList items={[zero, editable]} columns={1} />)
      );
      expect(required<HTMLInputElement>(host, "input")).toBe(input);
      expect(input.value).toBe("Keep this draft");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it.each([ListPageLayout, DetailPageLayout, FormPageLayout])(
    "preserves header, content, aside and footer actions for %s",
    (Layout) => {
      const host = document.createElement("div");
      const root = createRoot(host);
      const clicked = vi.fn();
      try {
        act(() =>
          root.render(
            <Layout
              aria-label="Task layout"
              aria-busy="true"
              header={
                <SectionHeader
                  heading="Task"
                  actions={
                    <Button onClick={() => clicked("header")}>
                      Header action
                    </Button>
                  }
                />
              }
              aside={
                <Button onClick={() => clicked("aside")}>Aside action</Button>
              }
              footer={
                <Button onClick={() => clicked("footer")}>Footer action</Button>
              }
            >
              <Card heading="Current item" description="Caller-owned data">
                <Button onClick={() => clicked("content")}>
                  Content action
                </Button>
              </Card>
            </Layout>
          )
        );
        expect(
          required<HTMLElement>(
            host,
            '[aria-label="Task layout"]'
          ).getAttribute("aria-busy")
        ).toBe("true");
        act(() =>
          host.querySelectorAll("button").forEach((button) => button.click())
        );
        expect(clicked.mock.calls.map(([source]) => source)).toStrictEqual([
          "header",
          "content",
          "aside",
          "footer",
        ]);
      } finally {
        act(() => root.unmount());
      }
    }
  );
});
