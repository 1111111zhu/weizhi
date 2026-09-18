#pragma once

#include <functional>

#include "NativeModules.h"

namespace winrt::ProjectWingDesktopAgent {
REACT_MODULE(DesktopAgentWindow)
struct DesktopAgentWindow {
  REACT_INIT(initialize)
  void initialize(React::ReactContext const &reactContext) noexcept;

  REACT_METHOD(minimize)
  void minimize() noexcept;

  REACT_METHOD(toggleMaximize)
  void toggleMaximize(std::function<void(bool)> const &callback) noexcept;

  REACT_METHOD(quit)
  void quit() noexcept;

  REACT_SYNC_METHOD(isMaximized)
  bool isMaximized() noexcept;

  REACT_EVENT(windowStateChanged, L"desktopAgentWindowStateChanged")
  std::function<void(bool)> windowStateChanged;
};
} // namespace winrt::ProjectWingDesktopAgent
