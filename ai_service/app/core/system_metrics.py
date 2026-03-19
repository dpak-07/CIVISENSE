from __future__ import annotations

import os
import platform
import time
from typing import Optional, Tuple

import ctypes
from ctypes import wintypes

try:
    import winreg  # type: ignore
except Exception:
    winreg = None


def _read_file(path: str) -> str | None:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    except FileNotFoundError:
        return None


def _read_meminfo() -> dict[str, int]:
    info: dict[str, int] = {}
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as handle:
            for line in handle:
                if ":" not in line:
                    continue
                key, value = line.split(":", 1)
                parts = value.strip().split()
                if not parts:
                    continue
                try:
                    info[key] = int(parts[0])
                except ValueError:
                    continue
    except FileNotFoundError:
        return {}
    return info


def _read_memory_windows() -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float]]:
    try:
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", wintypes.DWORD),
                ("dwMemoryLoad", wintypes.DWORD),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        status = MEMORYSTATUSEX()
        status.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
            return None, None, None, None

        total = status.ullTotalPhys
        avail = status.ullAvailPhys
        if total <= 0:
            return None, None, None, None

        total_mb = round(total / (1024 * 1024), 2)
        free_mb = round(avail / (1024 * 1024), 2)
        used_mb = round((total - avail) / (1024 * 1024), 2)
        used_pct = round(((total - avail) / total) * 100, 2)
        return total_mb, free_mb, used_mb, used_pct
    except Exception:
        return None, None, None, None


def _read_windows_registry_value(path: str, name: str) -> Optional[str]:
    if winreg is None:
        return None
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path) as key:
            value, _ = winreg.QueryValueEx(key, name)
            if value is None:
                return None
            return str(value).strip()
    except OSError:
        return None


def _read_windows_cpu_info() -> Tuple[Optional[str], Optional[int]]:
    name = _read_windows_registry_value(
        r"HARDWARE\DESCRIPTION\System\CentralProcessor\0",
        "ProcessorNameString",
    )
    mhz_raw = _read_windows_registry_value(
        r"HARDWARE\DESCRIPTION\System\CentralProcessor\0",
        "~MHz",
    )
    speed = None
    if mhz_raw:
        try:
            speed = int(mhz_raw)
        except ValueError:
            speed = None
    return name, speed


def _read_windows_device_info() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    vendor = _read_windows_registry_value(
        r"SYSTEM\CurrentControlSet\Control\SystemInformation",
        "SystemManufacturer",
    )
    product = _read_windows_registry_value(
        r"SYSTEM\CurrentControlSet\Control\SystemInformation",
        "SystemProductName",
    )
    bios = _read_windows_registry_value(
        r"SYSTEM\CurrentControlSet\Control\SystemInformation",
        "BIOSVersion",
    )
    return vendor, product, bios


def _read_windows_os_release() -> Optional[dict[str, str]]:
    product_name = _read_windows_registry_value(
        r"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
        "ProductName",
    )
    display_version = _read_windows_registry_value(
        r"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
        "DisplayVersion",
    )
    release_id = _read_windows_registry_value(
        r"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
        "ReleaseId",
    )
    version = display_version or release_id
    pretty_parts = [product_name, version]
    pretty = " ".join([part for part in pretty_parts if part])
    return {
        "id": "windows",
        "version": version,
        "prettyName": pretty or product_name,
    }


def _read_os_release() -> dict[str, str] | None:
    content = _read_file("/etc/os-release")
    if not content:
        return None
    data: dict[str, str] = {}
    for line in content.splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key] = value.strip().strip('"')
    return {
        "id": data.get("ID"),
        "version": data.get("VERSION_ID"),
        "prettyName": data.get("PRETTY_NAME"),
    }


def _read_uptime_seconds() -> int:
    if os.name == "nt":
        try:
            return int(ctypes.windll.kernel32.GetTickCount64() / 1000)
        except Exception:
            return int(time.monotonic())

    try:
        with open("/proc/uptime", "r", encoding="utf-8") as handle:
            parts = handle.read().strip().split()
            if parts:
                return int(float(parts[0]))
    except FileNotFoundError:
        return int(time.monotonic())
    return int(time.monotonic())


def _read_process_rss_mb() -> float | None:
    if os.name == "nt":
        try:
            class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
                _fields_ = [
                    ("cb", wintypes.DWORD),
                    ("PageFaultCount", wintypes.DWORD),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t),
                ]

            counters = PROCESS_MEMORY_COUNTERS()
            counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
            handle = ctypes.windll.kernel32.GetCurrentProcess()
            psapi = ctypes.WinDLL("psapi")
            get_info = psapi.GetProcessMemoryInfo
            get_info.restype = wintypes.BOOL
            get_info.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESS_MEMORY_COUNTERS), wintypes.DWORD]
            if get_info(handle, ctypes.byref(counters), counters.cb):
                return round(counters.WorkingSetSize / (1024 * 1024), 2)
        except Exception:
            return None
        return None

    try:
        with open("/proc/self/statm", "r", encoding="utf-8") as handle:
            parts = handle.read().strip().split()
            if len(parts) >= 2:
                rss_pages = int(parts[1])
                page_size = os.sysconf("SC_PAGE_SIZE")
                return round((rss_pages * page_size) / (1024 * 1024), 2)
    except (FileNotFoundError, ValueError, OSError):
        return None
    return None


def _read_cpu_info_linux() -> Tuple[Optional[str], Optional[int]]:
    try:
        with open("/proc/cpuinfo", "r", encoding="utf-8") as handle:
            model = None
            speed = None
            for line in handle:
                if ":" not in line:
                    continue
                key, value = line.split(":", 1)
                key = key.strip().lower()
                value = value.strip()
                if key == "model name" and not model:
                    model = value
                if key == "cpu mhz" and speed is None:
                    try:
                        speed = int(round(float(value)))
                    except ValueError:
                        speed = None
                if model and speed is not None:
                    break
            return model, speed
    except FileNotFoundError:
        return None, None


_last_cpu_sample: Tuple[int, int] | None = None


def _read_cpu_usage_pct_windows() -> Optional[float]:
    global _last_cpu_sample

    try:
        class FILETIME(ctypes.Structure):
            _fields_ = [("dwLowDateTime", wintypes.DWORD), ("dwHighDateTime", wintypes.DWORD)]

        idle_time = FILETIME()
        kernel_time = FILETIME()
        user_time = FILETIME()

        if not ctypes.windll.kernel32.GetSystemTimes(
            ctypes.byref(idle_time),
            ctypes.byref(kernel_time),
            ctypes.byref(user_time),
        ):
            return None

        def to_int(filetime: FILETIME) -> int:
            return (filetime.dwHighDateTime << 32) + filetime.dwLowDateTime

        idle = to_int(idle_time)
        kernel = to_int(kernel_time)
        user = to_int(user_time)
        total = kernel + user

        if _last_cpu_sample is None:
            _last_cpu_sample = (idle, total)
            return None

        last_idle, last_total = _last_cpu_sample
        idle_delta = idle - last_idle
        total_delta = total - last_total
        _last_cpu_sample = (idle, total)

        if total_delta <= 0:
            return None

        usage = (1 - idle_delta / total_delta) * 100
        return round(usage, 2)
    except Exception:
        return None


def get_system_metrics() -> dict:
    mem_total_mb = None
    mem_free_mb = None
    mem_used_mb = None
    mem_used_pct = None

    if os.name == "nt":
        mem_total_mb, mem_free_mb, mem_used_mb, mem_used_pct = _read_memory_windows()
    else:
        meminfo = _read_meminfo()
        total_kb = meminfo.get("MemTotal")
        available_kb = meminfo.get("MemAvailable") or meminfo.get("MemFree")
        free_kb = meminfo.get("MemFree")

        mem_total_mb = round(total_kb / 1024, 2) if total_kb else None
        mem_free_mb = round(free_kb / 1024, 2) if free_kb else None

        if total_kb is not None and available_kb is not None:
            mem_used_kb = max(total_kb - available_kb, 0)
            mem_used_mb = round(mem_used_kb / 1024, 2)
            mem_used_pct = round((mem_used_kb / total_kb) * 100, 2) if total_kb else None

    load_avg = None
    if hasattr(os, "getloadavg"):
        load_avg = [round(value, 2) for value in os.getloadavg()]

    cpu_model = None
    cpu_speed_mhz = None
    if platform.system().lower() == "linux":
        cpu_model, cpu_speed_mhz = _read_cpu_info_linux()
    elif os.name == "nt":
        cpu_model, cpu_speed_mhz = _read_windows_cpu_info()
        if not cpu_model:
            cpu_model = platform.processor() or None

    cpu_usage_pct = None
    if os.name == "nt":
        cpu_usage_pct = _read_cpu_usage_pct_windows()

    sys_vendor = _read_file("/sys/devices/virtual/dmi/id/sys_vendor")
    product_name = _read_file("/sys/devices/virtual/dmi/id/product_name")
    bios_version = _read_file("/sys/devices/virtual/dmi/id/bios_version")
    if os.name == "nt":
        win_vendor, win_product, win_bios = _read_windows_device_info()
        sys_vendor = sys_vendor or win_vendor
        product_name = product_name or win_product
        bios_version = bios_version or win_bios
    hypervisor_uuid = _read_file("/sys/hypervisor/uuid")
    vendor_lower = (sys_vendor or "").lower()
    cloud_provider = "aws" if "amazon" in vendor_lower or (hypervisor_uuid or "").lower().startswith("ec2") else None

    os_release = _read_os_release()
    if os.name == "nt":
        os_release = _read_windows_os_release()

    return {
        "hostname": platform.node(),
        "platform": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "cpuCount": os.cpu_count() or 0,
        "cpuModel": cpu_model,
        "cpuSpeedMHz": cpu_speed_mhz,
        "cpuUsagePct": cpu_usage_pct,
        "loadAvg": load_avg,
        "memTotalMB": mem_total_mb,
        "memFreeMB": mem_free_mb,
        "memUsedMB": mem_used_mb,
        "memUsedPct": mem_used_pct,
        "processRssMB": _read_process_rss_mb(),
        "uptimeSec": _read_uptime_seconds(),
        "osRelease": os_release,
        "device": {
            "vendor": sys_vendor,
            "productName": product_name,
            "biosVersion": bios_version,
            "cloudProvider": cloud_provider,
        },
    }
