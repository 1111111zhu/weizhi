#pragma once

#include <memory>

class TrayHost;

std::shared_ptr<TrayHost> CreateTrayHost(
    HINSTANCE instance,
    winrt::Microsoft::UI::Windowing::AppWindow const &appWindow);

void QuitDesktopAgentWindow();
