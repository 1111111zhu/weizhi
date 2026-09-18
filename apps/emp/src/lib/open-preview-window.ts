const CHANNEL_PREFIX = "project-wing-file-preview:";
const HANDOFF_TIMEOUT_MS = 15_000;

type PreviewWindowInput = {
  projectId?: string;
  fileName: string;
  loadBlob: () => Blob | Promise<Blob>;
  mimeType: string;
};

export function openAuthorizedPreviewWindow({
  projectId,
  fileName,
  loadBlob,
  mimeType,
}: PreviewWindowInput) {
  const nonce = createPreviewNonce();
  const channel = new BroadcastChannel(`${CHANNEL_PREFIX}${nonce}`);
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
    const onChannelMessage = (event: MessageEvent<unknown>) => {
      if (isPreviewReceivedMessage(event.data, nonce)) {
        return complete(true);
      }
      if (!isPreviewReadyMessage(event.data, nonce) || handoffStarted) {
        return;
      }
      handoffStarted = true;
      void Promise.resolve(loadBlob())
        .then((blob) => {
          channel.postMessage({
            blob,
            fileName,
            mimeType,
            nonce,
            type: "file",
            ...(projectId ? { projectId } : {}),
          });
        })
        .catch(() => complete(false));
    };
    channel.addEventListener("message", onChannelMessage);

    function complete(result: boolean) {
      window.clearTimeout(timeout);
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

function createPreviewNonce() {
  return crypto.randomUUID();
}

function isPreviewReadyMessage(value: unknown, nonce: string) {
  return (
    typeof value === "object" &&
    value !== null &&
    "nonce" in value &&
    "type" in value &&
    value.nonce === nonce &&
    value.type === "ready"
  );
}

function isPreviewReceivedMessage(value: unknown, nonce: string) {
  return (
    typeof value === "object" &&
    value !== null &&
    "nonce" in value &&
    "type" in value &&
    value.nonce === nonce &&
    value.type === "received"
  );
}
