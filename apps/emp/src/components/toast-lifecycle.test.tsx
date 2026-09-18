// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "./toast";

const navigation = vi.hoisted(() => ({ pathname: "/zh-CN/confirmations" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

afterEach(cleanup);

it("pauses the five-second notice on hover and supports action, close and navigation dismissal", async () => {
  const onGo = vi.fn();
  function Harness() {
    const { toast } = useToast();
    return <button type="button" onClick={() => toast({
      title: "Response matched", variant: "success", duration: 5000,
      closeButton: true, dismissOnNavigation: true,
      actions: [{ label: "Go to confirmation", onClick: onGo }],
    })}>Show result</button>;
  }
  const view = render(<ToastProvider><Harness /></ToastProvider>);
  const show = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Show result" }));
    return await screen.findByText("Response matched");
  };
  const absent = () => waitFor(() => expect(screen.queryByText("Response matched")).not.toBeInTheDocument(), { timeout: 6500 });

  const notification = await show();
  const list = notification.closest("ol")!;
  fireEvent.mouseEnter(list);
  await new Promise(resolve => setTimeout(resolve, 5200));
  expect(screen.getByText("Response matched")).toBeVisible();
  fireEvent.mouseLeave(list);
  await absent();

  await show();
  fireEvent.click(screen.getByRole("button", { name: "Close toast" }));
  await absent();

  await show();
  fireEvent.click(screen.getByRole("button", { name: "Go to confirmation" }));
  expect(onGo).toHaveBeenCalledOnce();
  await absent();

  await show();
  navigation.pathname = "/zh-CN/engagement/project-1";
  view.rerender(<ToastProvider><Harness /></ToastProvider>);
  await absent();
}, 20000);
