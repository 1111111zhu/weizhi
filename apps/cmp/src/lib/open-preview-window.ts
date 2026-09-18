const CHANNEL_PREFIX = "project-wing-file-preview:";
const HANDOFF_TIMEOUT_MS = 15_000;

type PreviewWindowInput = {
  fileName: string;
  loadBlob: () => Promise<Blob>;
  mimeType: string;
};

export function openAuthorizedPreviewWindow({
  fileName,
  loadBlob,
  mimeType,
}: PreviewWindowInput) {
  const nonce = crypto.randomUUID();
  const channel = new BroadcastChannel(getPreviewChannelName(nonce));
  const previewWindow = window.open(buildPreviewUrl(nonce), "_blank");

  if (!previewWindow) {
    channel.close();
    return Promise.resolve(false);
  }

  const detachedWindow = previewWindow;
  detachedWindow.opener = null;
  return new Promise<boolean>((resolve) => {
    let handoffStarted = false;
    const timeout = window.setTimeout(
      () => complete(false),
      HANDOFF_TIMEOUT_MS
    );
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (isMessage(event.data, nonce, "received")) {
        return complete(true);
      }
      if (!isMessage(event.data, nonce, "ready") || handoffStarted) {
        return;
      }
      handoffStarted = true;
      void loadBlob()
        .then((blob) => {
          channel.postMessage({
            blob,
            fileName,
            mimeType: blob.type || mimeType,
            nonce,
            type: "file",
          });
        })
        .catch(() => complete(false));
    };
    channel.addEventListener("message", handleMessage);

    function complete(result: boolean) {
      window.clearTimeout(timeout);
      channel.removeEventListener("message", handleMessage);
      channel.close();
      if (!result) {
        detachedWindow.close();
      }
      resolve(result);
    }
  });
}

export function getPreviewChannelName(nonce: string) {
  return `${CHANNEL_PREFIX}${nonce}`;
}

function buildPreviewUrl(nonce: string) {
  const currentUrl = new URL(window.location.href);
  const locale = currentUrl.pathname.split("/").find(Boolean) ?? "en-US";
  const previewUrl = new URL(`/${locale}/preview`, currentUrl.origin);
  previewUrl.searchParams.set("nonce", nonce);
  return previewUrl.toString();
}

function isMessage(value: unknown, nonce: string, type: string) {
  return (
    typeof value === "object" &&
    value !== null &&
    "nonce" in value &&
    "type" in value &&
    value.nonce === nonce &&
    value.type === type
  );
}
