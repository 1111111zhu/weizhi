#pragma once

#include <functional>

void ConfigureDesktopAgentWindowControls(
    winrt::Microsoft::UI::Windowing::AppWindow const &appWindow);
void ResetDesktopAgentWindowToCompact();
void MinimizeDesktopAgentWindow();
bool IsDesktopAgentWindowMinimized();
bool ToggleDesktopAgentWindowMaximized();
bool IsDesktopAgentWindowMaximized();
void SetDesktopAgentWindowStateListener(std::function<void(bool)> listener);
