#include "pch.h"
#include "TrayHost.h"

#include "ProcessLifecycle.h"
#include "resource.h"
#include "WindowControls.h"

#include <shellapi.h>
#include <winhttp.h>

namespace {
constexpr wchar_t kTrayWindowClass[] = L"ProjectWingDesktopAgentTray";
constexpr wchar_t kTooltip[] = L"Project Wing Desktop Agent";
constexpr UINT kTrayCallbackMessage = WM_APP + 1;
constexpr UINT kTrayIconId = 1;
constexpr UINT kQuitCommandId = 1001;
constexpr int kWindowMargin = 12;
UINT taskbarCreatedMessage = 0;

bool RequestRuntimeShutdown() {
  HINTERNET session = WinHttpOpen(
      L"ProjectWingDesktopAgent/0.2.0", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
      WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
  HINTERNET connection = nullptr;
  HINTERNET request = nullptr;
  bool succeeded = false;
  if (session) {
    WinHttpSetTimeouts(session, 1000, 1000, 1000, 1000);
    connection = WinHttpConnect(session, L"127.0.0.1", 17862, 0);
  }
  if (connection) {
    request = WinHttpOpenRequest(
        connection, L"POST", L"/control/shutdown", nullptr, WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES, 0);
  }
  if (request) {
    DWORD statusCode = 0;
    DWORD statusCodeSize = sizeof(statusCode);
    succeeded =
        WinHttpSendRequest(
            request, WINHTTP_NO_ADDITIONAL_HEADERS, 0,
            WINHTTP_NO_REQUEST_DATA, 0, 0, 0) &&
        WinHttpReceiveResponse(request, nullptr) &&
        WinHttpQueryHeaders(
            request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_HEADER_NAME_BY_INDEX, &statusCode, &statusCodeSize,
            WINHTTP_NO_HEADER_INDEX) &&
        statusCode == HTTP_STATUS_ACCEPTED;
  }
  if (request) WinHttpCloseHandle(request);
  if (connection) WinHttpCloseHandle(connection);
  if (session) WinHttpCloseHandle(session);
  return succeeded;
}

}

class TrayHost {
 public:
  explicit TrayHost(winrt::Microsoft::UI::Windowing::AppWindow const &window)
      : appWindow(window), ownerWindow(winrt::Microsoft::UI::GetWindowFromWindowId(window.Id())) {}

  ~TrayHost() {
    RemoveIcon();
    if (messageWindow) DestroyWindow(messageWindow);
  }

  void AddIcon(HINSTANCE instance) {
    RemoveIcon();
    icon = {};
    icon.cbSize = sizeof(icon);
    icon.hWnd = messageWindow;
    icon.uID = kTrayIconId;
    icon.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    icon.uCallbackMessage = kTrayCallbackMessage;
    trayIcon = static_cast<HICON>(LoadImageW(
        instance,
        MAKEINTRESOURCEW(IDI_ICON1),
        IMAGE_ICON,
        GetSystemMetrics(SM_CXSMICON),
        GetSystemMetrics(SM_CYSMICON),
        LR_DEFAULTCOLOR));
    icon.hIcon = trayIcon ? trayIcon : LoadIconW(instance, MAKEINTRESOURCEW(IDI_ICON1));
    wcscpy_s(icon.szTip, kTooltip);
    iconVisible = Shell_NotifyIconW(NIM_ADD, &icon) == TRUE;
    if (!iconVisible && trayIcon) {
      DestroyIcon(trayIcon);
      trayIcon = nullptr;
    }
  }

  void RemoveIcon() {
    if (!iconVisible) return;
    Shell_NotifyIconW(NIM_DELETE, &icon);
    iconVisible = false;
    if (trayIcon) {
      DestroyIcon(trayIcon);
      trayIcon = nullptr;
    }
  }

  void TogglePanel() {
    if (IsDesktopAgentWindowMinimized()) {
      appWindow.Presenter().as<winrt::Microsoft::UI::Windowing::OverlappedPresenter>().Restore();
      appWindow.Show(true);
      appWindow.MoveInZOrderAtTop();
      return;
    }
    if (appWindow.IsVisible()) {
      appWindow.Hide();
      return;
    }
    if (!hasPositionedPanel) {
      MovePanelToWorkArea();
      hasPositionedPanel = true;
    }
    appWindow.Show(true);
    appWindow.MoveInZOrderAtTop();
  }

  void Quit() {
    if (!RequestRuntimeShutdown()) {
      WriteShutdownFlag();
      StopManagedRuntimeProcessesForCurrentInstall();
    }
    quitting = true;
    RemoveIcon();
    appWindow.Destroy();
  }

  void ShowContextMenu() {
    POINT cursor{};
    GetCursorPos(&cursor);
    HMENU menu = CreatePopupMenu();
    AppendMenuW(menu, MF_STRING, kQuitCommandId, L"Quit Project Wing Desktop Agent");
    SetForegroundWindow(ownerWindow);
    const auto command = TrackPopupMenu(
        menu, TPM_RETURNCMD | TPM_NONOTIFY, cursor.x, cursor.y, 0, messageWindow, nullptr);
    DestroyMenu(menu);
    if (command == kQuitCommandId) Quit();
  }

  winrt::Microsoft::UI::Windowing::AppWindow appWindow{nullptr};
  HWND messageWindow{nullptr};
  HWND ownerWindow{nullptr};
  NOTIFYICONDATAW icon{};
  HICON trayIcon{nullptr};
  bool iconVisible{false};
  bool quitting{false};
  bool hideOnFirstShow{true};
  bool hasPositionedPanel{false};

 private:
  void MovePanelToWorkArea() {
    RECT workArea{};
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0);
    const auto size = appWindow.Size();
    appWindow.Move({
        workArea.right - size.Width - kWindowMargin,
        workArea.bottom - size.Height - kWindowMargin,
    });
  }
};

std::weak_ptr<TrayHost> g_trayHost;

namespace {
LRESULT CALLBACK TrayWindowProc(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
  auto *host = reinterpret_cast<TrayHost *>(GetWindowLongPtrW(window, GWLP_USERDATA));
  if (message == WM_NCCREATE) {
    const auto *create = reinterpret_cast<CREATESTRUCTW *>(lParam);
    host = static_cast<TrayHost *>(create->lpCreateParams);
    SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(host));
  }
  if (!host) return DefWindowProcW(window, message, wParam, lParam);
  if (message == taskbarCreatedMessage) host->AddIcon(GetModuleHandleW(nullptr));
  if (message == kTrayCallbackMessage && lParam == WM_LBUTTONUP) host->TogglePanel();
  if (message == kTrayCallbackMessage && lParam == WM_RBUTTONUP) host->ShowContextMenu();
  return DefWindowProcW(window, message, wParam, lParam);
}

bool RegisterTrayWindowClass(HINSTANCE instance) {
  WNDCLASSW windowClass{};
  windowClass.lpfnWndProc = TrayWindowProc;
  windowClass.hInstance = instance;
  windowClass.lpszClassName = kTrayWindowClass;
  return RegisterClassW(&windowClass) || GetLastError() == ERROR_CLASS_ALREADY_EXISTS;
}

void ConfigureWindowEvents(TrayHost &host) {
  host.appWindow.Closing([&host](auto const &, auto const &args) {
    if (host.quitting) return;
    args.Cancel(true);
    host.appWindow.Hide();
  });
  host.appWindow.Changed([&host](auto const &window, auto const &args) {
    if (!host.hideOnFirstShow || !args.DidVisibilityChange() || !window.IsVisible()) return;
    host.hideOnFirstShow = false;
    window.Hide();
  });
}
}

void QuitDesktopAgentWindow() {
  if (const auto host = g_trayHost.lock()) host->Quit();
}

std::shared_ptr<TrayHost> CreateTrayHost(
    HINSTANCE instance,
    winrt::Microsoft::UI::Windowing::AppWindow const &appWindow) {
  if (!RegisterTrayWindowClass(instance)) return nullptr;
  auto host = std::make_shared<TrayHost>(appWindow);
  g_trayHost = host;
  taskbarCreatedMessage = RegisterWindowMessageW(L"TaskbarCreated");
  host->messageWindow = CreateWindowExW(
      0, kTrayWindowClass, kTooltip, 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, instance, host.get());
  if (!host->messageWindow) return nullptr;
  ConfigureWindowEvents(*host);
  host->AddIcon(instance);
  return host;
}
