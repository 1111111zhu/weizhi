// ProjectWingDesktopAgent.cpp : Defines the entry point for the application.
//

#include "pch.h"
#include "ProjectWingDesktopAgent.h"
#include "TrayHost.h"
#include "DesktopAgentWindowModule.h"
#include "WindowControls.h"

#include "AutolinkedNativeModules.g.h"

#include "NativeModules.h"

#include <array>

// A PackageProvider containing any turbo modules you define within this app project
struct CompReactPackageProvider
    : winrt::implements<CompReactPackageProvider, winrt::Microsoft::ReactNative::IReactPackageProvider> {
 public: // IReactPackageProvider
  void CreatePackage(winrt::Microsoft::ReactNative::IReactPackageBuilder const &packageBuilder) noexcept {
    AddAttributedModules(packageBuilder, true);
  }
};

// The entry point of the Win32 application
_Use_decl_annotations_ int CALLBACK WinMain(
    HINSTANCE instance,
    HINSTANCE,
    PSTR /* commandLine */,
    int /* showCmd */) {
  HANDLE mutexHandle = CreateMutexW(nullptr, TRUE, L"Local\\ProjectWingDesktopAgentUi");
  const auto mutexError = GetLastError();
  winrt::handle singleInstance{mutexHandle};
  if (!singleInstance || mutexError == ERROR_ALREADY_EXISTS) return EXIT_SUCCESS;

  // Initialize WinRT
  winrt::init_apartment(winrt::apartment_type::single_threaded);

  // Enable per monitor DPI scaling
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

  // Find the path hosting the app exe file
  WCHAR appDirectory[MAX_PATH];
  GetModuleFileNameW(NULL, appDirectory, MAX_PATH);
  PathCchRemoveFileSpec(appDirectory, MAX_PATH);

  // Create a ReactNativeWin32App with the ReactNativeAppBuilder
  auto reactNativeWin32App{winrt::Microsoft::ReactNative::ReactNativeAppBuilder().Build()};

  // Configure the initial InstanceSettings for the app's ReactNativeHost
  auto settings{reactNativeWin32App.ReactNativeHost().InstanceSettings()};
  // Register any autolinked native modules
  RegisterAutolinkedNativeModulePackages(settings.PackageProviders());
  // Register any native modules defined within this app project
  settings.PackageProviders().Append(winrt::make<CompReactPackageProvider>());

#if BUNDLE
  // Load the JS bundle from a file (not Metro):
  // Set the path (on disk) where the .bundle file is located
  settings.BundleRootPath(std::wstring(L"file://").append(appDirectory).append(L"\\Bundle\\").c_str());
  // Set the name of the bundle file (without the .bundle extension)
  settings.JavaScriptBundleFile(L"index.windows");
  // Disable hot reload
  settings.UseFastRefresh(false);
#else
  // Load the JS bundle from Metro
  settings.JavaScriptBundleFile(L"index");
  // Enable hot reload
  settings.UseFastRefresh(true);
#endif
#if _DEBUG
  // For Debug builds
  // Enable Direct Debugging of JS
  settings.UseDirectDebugger(true);
  // Enable the Developer Menu
  settings.UseDeveloperSupport(true);
#else
  // For Release builds:
  // Disable Direct Debugging of JS
  settings.UseDirectDebugger(false);
  // Disable the Developer Menu
  settings.UseDeveloperSupport(false);
#endif

  // Get the AppWindow so we can configure its initial title and size
  auto appWindow{reactNativeWin32App.AppWindow()};
  appWindow.Title(L"Project Wing Desktop Agent");
  const auto windowHandle = winrt::Microsoft::UI::GetWindowFromWindowId(appWindow.Id());
  const auto largeIcon = static_cast<HICON>(LoadImageW(
      instance,
      MAKEINTRESOURCEW(IDI_ICON1),
      IMAGE_ICON,
      GetSystemMetrics(SM_CXICON),
      GetSystemMetrics(SM_CYICON),
      LR_DEFAULTCOLOR));
  const auto smallIcon = static_cast<HICON>(LoadImageW(
      instance,
      MAKEINTRESOURCEW(IDI_ICON1),
      IMAGE_ICON,
      GetSystemMetrics(SM_CXSMICON),
      GetSystemMetrics(SM_CYSMICON),
      LR_DEFAULTCOLOR));
  if (largeIcon) SendMessageW(windowHandle, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(largeIcon));
  if (smallIcon) SendMessageW(windowHandle, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(smallIcon));
  auto presenter = appWindow.Presenter().as<winrt::Microsoft::UI::Windowing::OverlappedPresenter>();
  presenter.IsResizable(false);
  presenter.IsMaximizable(true);
  presenter.IsMinimizable(true);
  presenter.SetBorderAndTitleBar(false, false);

  auto trayHost = CreateTrayHost(instance, appWindow);
  if (!trayHost) return EXIT_FAILURE;
  ConfigureDesktopAgentWindowControls(appWindow);
  ResetDesktopAgentWindowToCompact();

  auto nonClientPointerSource =
      winrt::Microsoft::UI::Input::InputNonClientPointerSource::GetForWindowId(appWindow.Id());
  std::array<winrt::Windows::Graphics::RectInt32, 1> captionRects{};
  captionRects[0] = {
      0,
      0,
      MulDiv(225, GetDpiForWindow(windowHandle), USER_DEFAULT_SCREEN_DPI),
      MulDiv(52, GetDpiForWindow(windowHandle), USER_DEFAULT_SCREEN_DPI),
  };
  nonClientPointerSource.SetRegionRects(
      winrt::Microsoft::UI::Input::NonClientRegionKind::Caption, captionRects);

  // Get the ReactViewOptions so we can set the initial RN component to load
  auto viewOptions{reactNativeWin32App.ReactViewOptions()};
  viewOptions.ComponentName(L"ProjectWingDesktopAgent");

  // Start the app
  reactNativeWin32App.Start();
  if (smallIcon) DestroyIcon(smallIcon);
  if (largeIcon) DestroyIcon(largeIcon);
  return EXIT_SUCCESS;
}
