#include "pch.h"
#include "WindowControls.h"

#include <cstdint>

namespace {
constexpr int kCompactWidth = 400;
constexpr int kCompactHeight = 540;
constexpr int kWindowMargin = 12;

winrt::Microsoft::UI::Windowing::AppWindow g_appWindow{nullptr};
std::function<void(bool)> g_windowStateListener;

winrt::Microsoft::UI::Windowing::OverlappedPresenter GetPresenter() {
  return g_appWindow.Presenter().as<winrt::Microsoft::UI::Windowing::OverlappedPresenter>();
}

void MoveCompactWindowIntoWorkArea() {
  const auto hwnd = winrt::Microsoft::UI::GetWindowFromWindowId(g_appWindow.Id());
  const auto monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
  MONITORINFO monitorInfo{sizeof(monitorInfo)};
  if (!GetMonitorInfoW(monitor, &monitorInfo)) return;

  const auto size = g_appWindow.Size();
  const auto workArea = monitorInfo.rcWork;
  const auto minLeft = static_cast<std::int32_t>(workArea.left + kWindowMargin);
  const auto minTop = static_cast<std::int32_t>(workArea.top + kWindowMargin);
  const auto maxLeft = static_cast<std::int32_t>(
      workArea.right - size.Width - kWindowMargin);
  const auto maxTop = static_cast<std::int32_t>(
      workArea.bottom - size.Height - kWindowMargin);
  const auto position = g_appWindow.Position();
  g_appWindow.Move({
      std::clamp(position.X, minLeft, std::max(minLeft, maxLeft)),
      std::clamp(position.Y, minTop, std::max(minTop, maxTop)),
  });
}
}

void ConfigureDesktopAgentWindowControls(
    winrt::Microsoft::UI::Windowing::AppWindow const &appWindow) {
  g_appWindow = appWindow;
  g_appWindow.Changed([](auto const &, auto const &args) {
    if (args.DidPresenterChange() && g_windowStateListener) {
      g_windowStateListener(IsDesktopAgentWindowMaximized());
    }
  });
}

void ResetDesktopAgentWindowToCompact() {
  if (!g_appWindow) return;
  const auto hwnd = winrt::Microsoft::UI::GetWindowFromWindowId(g_appWindow.Id());
  const auto dpi = GetDpiForWindow(hwnd);
  GetPresenter().Restore();
  g_appWindow.Resize({
      MulDiv(kCompactWidth, dpi, USER_DEFAULT_SCREEN_DPI),
      MulDiv(kCompactHeight, dpi, USER_DEFAULT_SCREEN_DPI),
  });
  MoveCompactWindowIntoWorkArea();
}

void MinimizeDesktopAgentWindow() {
  if (!g_appWindow) return;
  ShowWindow(winrt::Microsoft::UI::GetWindowFromWindowId(g_appWindow.Id()), SW_MINIMIZE);
}

bool IsDesktopAgentWindowMinimized() {
  return g_appWindow && IsIconic(winrt::Microsoft::UI::GetWindowFromWindowId(g_appWindow.Id()));
}

bool ToggleDesktopAgentWindowMaximized() {
  if (!g_appWindow) return false;
  auto presenter = GetPresenter();
  if (presenter.State() == winrt::Microsoft::UI::Windowing::OverlappedPresenterState::Maximized) {
    presenter.Restore();
    return false;
  }
  presenter.Maximize();
  return true;
}

bool IsDesktopAgentWindowMaximized() {
  return g_appWindow &&
      GetPresenter().State() == winrt::Microsoft::UI::Windowing::OverlappedPresenterState::Maximized;
}

void SetDesktopAgentWindowStateListener(std::function<void(bool)> listener) {
  g_windowStateListener = std::move(listener);
  if (g_windowStateListener) g_windowStateListener(IsDesktopAgentWindowMaximized());
}
