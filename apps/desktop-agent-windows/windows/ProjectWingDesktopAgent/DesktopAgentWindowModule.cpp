#include "pch.h"
#include "DesktopAgentWindowModule.h"
#include "TrayHost.h"
#include "WindowControls.h"

namespace winrt::ProjectWingDesktopAgent {
void DesktopAgentWindow::initialize(React::ReactContext const &) noexcept {
  SetDesktopAgentWindowStateListener([this](bool maximized) {
    if (windowStateChanged) windowStateChanged(maximized);
  });
}

void DesktopAgentWindow::minimize() noexcept { MinimizeDesktopAgentWindow(); }

void DesktopAgentWindow::toggleMaximize(std::function<void(bool)> const &callback) noexcept {
  callback(ToggleDesktopAgentWindowMaximized());
}

void DesktopAgentWindow::quit() noexcept { QuitDesktopAgentWindow(); }

bool DesktopAgentWindow::isMaximized() noexcept { return IsDesktopAgentWindowMaximized(); }
} // namespace winrt::ProjectWingDesktopAgent
