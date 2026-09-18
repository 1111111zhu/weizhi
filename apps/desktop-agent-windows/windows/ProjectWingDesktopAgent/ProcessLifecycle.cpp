#include "ProcessLifecycle.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>
#include <tlhelp32.h>

#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

namespace {
constexpr DWORD kMaximumWindowsPathLength = 32768;
constexpr wchar_t kManagerExecutable[] = L"ProjectWing.AgentManager.exe";
constexpr wchar_t kRuntimeExecutable[] = L"ProjectWing.DesktopAgent.Runtime.exe";

bool ReadEnvironmentVariable(const wchar_t *name, std::wstring &value) {
  const auto required = GetEnvironmentVariableW(name, nullptr, 0);
  if (!required) return false;
  std::vector<wchar_t> buffer(required);
  const auto length = GetEnvironmentVariableW(name, buffer.data(), required);
  if (!length || length >= required) return false;
  value.assign(buffer.data(), length);
  return true;
}

std::filesystem::path CurrentExecutablePath() {
  std::vector<wchar_t> buffer(kMaximumWindowsPathLength);
  const auto length = GetModuleFileNameW(
      nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
  if (!length || length >= static_cast<DWORD>(buffer.size())) return {};
  return std::filesystem::path(std::wstring(buffer.data(), length));
}

std::filesystem::path CurrentInstallRoot() {
  const auto executable = CurrentExecutablePath();
  if (executable.empty()) return {};
  const auto appRoot = executable.parent_path().parent_path();
  return appRoot.empty() ? std::filesystem::path{} : appRoot.parent_path();
}

bool IsManagedExecutable(const wchar_t *name) {
  return _wcsicmp(name, kManagerExecutable) == 0 ||
      _wcsicmp(name, kRuntimeExecutable) == 0;
}

bool IsInsideInstallRoot(
    const std::filesystem::path &candidate,
    const std::filesystem::path &installRoot) {
  auto root = installRoot.lexically_normal().native();
  if (root.empty()) return false;
  if (root.back() != L'\\' && root.back() != L'/') root.push_back(L'\\');
  const auto path = candidate.lexically_normal().native();
  return path.size() > root.size() &&
      _wcsnicmp(path.c_str(), root.c_str(), root.size()) == 0;
}

std::filesystem::path ProcessExecutablePath(HANDLE process) {
  std::vector<wchar_t> buffer(kMaximumWindowsPathLength);
  DWORD length = static_cast<DWORD>(buffer.size());
  if (!QueryFullProcessImageNameW(process, 0, buffer.data(), &length)) return {};
  return std::filesystem::path(std::wstring(buffer.data(), length));
}

void StopProcessIfOwned(const PROCESSENTRY32W &entry, const std::filesystem::path &root) {
  if (!IsManagedExecutable(entry.szExeFile)) return;
  HANDLE process = OpenProcess(
      PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE,
      FALSE,
      entry.th32ProcessID);
  if (!process) return;
  const auto executable = ProcessExecutablePath(process);
  if (!executable.empty() && IsInsideInstallRoot(executable, root)) {
    TerminateProcess(process, 0);
  }
  CloseHandle(process);
}
}

void WriteShutdownFlag() {
  std::wstring stateRootValue;
  const auto hasConfiguredStateRoot =
      ReadEnvironmentVariable(L"PROJECT_WING_AGENT_STATE_ROOT", stateRootValue);
  if (!hasConfiguredStateRoot &&
      !ReadEnvironmentVariable(L"LOCALAPPDATA", stateRootValue)) {
    return;
  }
  std::filesystem::path stateRoot = stateRootValue;
  if (!hasConfiguredStateRoot) {
    stateRoot /= L"ProjectWing";
    stateRoot /= L"AgentState";
  }
  std::error_code error;
  std::filesystem::create_directories(stateRoot, error);
  if (error) return;
  std::ofstream(stateRoot / L"shutdown.flag", std::ios::trunc) << "native-shutdown\n";
}

void StopManagedRuntimeProcessesForCurrentInstall() {
  const auto installRoot = CurrentInstallRoot();
  if (installRoot.empty()) return;
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) return;
  PROCESSENTRY32W entry{};
  entry.dwSize = sizeof(entry);
  if (Process32FirstW(snapshot, &entry)) {
    do {
      StopProcessIfOwned(entry, installRoot);
    } while (Process32NextW(snapshot, &entry));
  }
  CloseHandle(snapshot);
}
