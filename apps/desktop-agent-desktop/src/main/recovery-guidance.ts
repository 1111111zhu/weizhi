export function getRecoveryGuidance(error: unknown, locale: string) {
  const message = error instanceof Error ? error.message : String(error);
  const chinese = locale.toLowerCase().startsWith("zh");
  const activeUpdate = /update is in progress|stopping or updating/i.test(
    message
  );
  const interrupted =
    /previous local update|ownership cannot be verified/i.test(message);
  const conflict =
    /unrecognized service|another agent version|service changed/i.test(message);
  const missing =
    /runtime files are missing|installation.*missing|helper.*integrity/i.test(
      message
    );
  const description = activeUpdate
    ? [
        "本地更新正在进行。完成后服务会自动恢复，请稍后再试。",
        "A local update is running. The service will resume when it finishes; please try again shortly.",
      ]
    : interrupted
      ? [
          "上次更新被中断。请打开已安装的 Desktop Agent，选择“检查更新”继续处理；无需删除本地文件。",
          "The previous update was interrupted. Open the installed Desktop Agent and choose Check for updates to continue; keep your local files.",
        ]
      : conflict
        ? [
            "发现另一个本地服务或 Agent 版本。为保护现有工作，没有强制停止任何程序。请打开本地应用查看状态并重试。",
            "Another local service or Agent version is active. No process was forcibly stopped. Open the local app to review its status and retry.",
          ]
        : missing
          ? [
              "安装文件未通过完整性检查，服务未被替换。请打开本地应用重试更新；如果问题持续，请联系支持并保留本地工作文件。",
              "Installation integrity could not be verified; the service was not replaced. Retry the update in the local app, or contact support if this continues. Keep your working files.",
            ]
          : [
              "本地服务尚未确认恢复。你的工作文件仍保留。请打开本地应用查看状态后重试；无需前往任务管理器。",
              "The local service has not confirmed recovery. Your working files are retained. Open the local app to review its status and retry; no Task Manager action is needed.",
            ];
  return {
    title: chinese ? "恢复 Desktop Agent" : "Recover Desktop Agent",
    message: chinese
      ? activeUpdate
        ? "正在完成本地更新"
        : "本地服务需要继续处理"
      : activeUpdate
        ? "Local update in progress"
        : "Local service needs attention",
    detail: description[chinese ? 0 : 1],
    openLabel: chinese ? "打开本地应用" : "Open local app",
    closeLabel: chinese ? "稍后" : "Later",
  };
}
