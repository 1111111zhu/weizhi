import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopAgentCacheSettings } from "./desktop-agent-cache-settings";

const toast = vi.hoisted(() => vi.fn());

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    dictionary: {
      workbench: {
        settingsPanel: {
          desktopAgentCache: {
            title: "Local file cache",
            description: "Caches recent workpapers for faster reopening",
            location: "Cache location",
            placeholder: "Choose cache path",
            directoryPickerUnavailable: "Directory picker unavailable",
            loading: "Reading settings...",
            retry: "Retry",
            capacity: "Current usage: {used}/{size}",
            performance: "Cache hits: {hits}; download avoided: {saved}",
            save: "Save",
            saving: "Saving...",
            saved: "Cache location updated",
            saveError: "Could not update cache location",
            requiresIdle:
              "Close local working files and wait for uploads; the current location is unchanged.",
            unavailable: "Desktop Agent is not running.",
            upgradeRequired: "Update Desktop Agent first.",
          },
        },
      },
    },
  }),
}));

vi.mock("./toast", () => ({
  useToast: () => ({ toast }),
}));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe(DesktopAgentCacheSettings, () => {
    it("explains why an active-session cache move was safely refused without changing the saved root", async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            cacheRoot: "D:\\ProjectWingCache",
            maxBytes: 5 * 1024 ** 3,
          })
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              ok: false,
              code: "CACHE_CHANGE_REQUIRES_IDLE",
              message: "Close files first",
            },
            409
          )
        );
      vi.stubGlobal("fetch", fetcher);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={queryClient}>
          <DesktopAgentCacheSettings />
        </QueryClientProvider>
      );
      const input = await screen.findByDisplayValue("D:\\ProjectWingCache");
      fireEvent.change(input, { target: { value: "E:\\NewCache" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith({
          title:
            "Close local working files and wait for uploads; the current location is unchanged.",
          variant: "destructive",
        })
      );
      expect(
        queryClient.getQueryData(["desktop-agent", "cache-settings"])
      ).toMatchObject({ cacheRoot: "D:\\ProjectWingCache" });
    });

    it("shows native cache settings and persists an edited absolute path", async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            cacheRoot: "D:\\ProjectWingCache",
            maxBytes: 5 * 1024 ** 3,
            usedBytes: 1024,
            entryCount: 2,
            orphanBytes: 0,
            orphanCount: 0,
            hitCount: 3,
            missCount: 1,
            bytesSaved: 4096,
            restartRequired: false,
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            cacheRoot: "E:\\ProjectWingCache",
            maxBytes: 5 * 1024 ** 3,
            usedBytes: 0,
            entryCount: 0,
            orphanBytes: 0,
            orphanCount: 0,
            hitCount: 3,
            missCount: 1,
            bytesSaved: 4096,
            restartRequired: false,
          })
        );
      vi.stubGlobal("fetch", fetcher);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(DesktopAgentCacheSettings)
        )
      );

      const input = await screen.findByDisplayValue(
        String.raw`D:\ProjectWingCache`
      );
      expect(screen.queryByText("Desktop Agent is not running.")).toBeNull();
      expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      fireEvent.keyDown(input, { key: "Enter" });
      expect(fetcher).toHaveBeenCalledOnce();
      fireEvent.change(input, { target: { value: "E:\\ProjectWingCache" } });
      const saveButton = screen
        .getAllByRole("button", { name: "Save" })
        .find(
          (element): element is HTMLButtonElement =>
            element instanceof HTMLButtonElement
        );
      if (!saveButton) {
        throw new Error("Expected the cache settings Save button");
      }
      fireEvent.click(saveButton);

      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      expect(fetcher).toHaveBeenLastCalledWith(
        "http://127.0.0.1:17862/cache/settings",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            cacheRoot: "E:\\ProjectWingCache",
            maxBytes: 5 * 1024 ** 3,
          }),
        })
      );
      expect(toast).toHaveBeenCalledWith({ title: "Cache location updated" });
    });

    it("keeps connection failures visible and retries without changing native settings", async () => {
      const fetcher = vi
        .fn()
        .mockRejectedValueOnce(new Error("Offline"))
        .mockResolvedValue(
          jsonResponse({
            ok: true,
            cacheRoot: "D:\\ProjectWingCache",
            maxBytes: 5 * 1024 ** 3,
            usedBytes: 0,
            entryCount: 0,
            orphanBytes: 0,
            orphanCount: 0,
            hitCount: 0,
            missCount: 0,
            bytesSaved: 0,
            restartRequired: false,
          })
        );
      vi.stubGlobal("fetch", fetcher);
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={client}>
          <DesktopAgentCacheSettings />
        </QueryClientProvider>
      );
      await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
        "Desktop Agent is not running."
      );
      expect(
        screen.getByRole("textbox", { name: "Cache location" })
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await screen.findByDisplayValue("D:\\ProjectWingCache");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(
        fetcher.mock.calls.every(([, options]) => options?.method !== "POST")
      ).toBeTruthy();
    });
  });

  function jsonResponse(value: unknown, status = 200) {
    return Response.json(value, { status });
  }
});
