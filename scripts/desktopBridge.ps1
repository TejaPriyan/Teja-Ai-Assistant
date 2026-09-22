param(
    [Parameter(Mandatory=$true)][string]$Action,
    [string]$Target = "",
    [string]$SubAction = "focus",
    [string]$Keys = "",
    [string]$X = "0",
    [string]$Y = "0",
    [string]$X2 = "0",
    [string]$Y2 = "0",
    [string]$Clicks = "1"
)

$csharp = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
using System.Threading;

public class DesktopBridge {
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool CloseDesktop(IntPtr hDesktop);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left; public int Top; public int Right; public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X; public int Y;
    }

    const uint DESKTOP_ALL = 0x01FF;
    const uint WM_CLOSE = 0x0010;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    const uint MOUSEEVENTF_WHEEL = 0x0800;

    public class WindowEntry {
        public long Hwnd;
        public uint Pid;
        public string Title;
        public string ClassName;
    }

    public static List<WindowEntry> ListWindows() {
        var list = new List<WindowEntry>();
        IntPtr hDesk = OpenDesktop("default", 0, false, DESKTOP_ALL);
        if (hDesk == IntPtr.Zero) return list;

        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                int len = GetWindowTextLength(hWnd);
                if (len > 0) {
                    var sb = new StringBuilder(len + 1);
                    GetWindowText(hWnd, sb, sb.Capacity);
                    string title = sb.ToString().Trim();
                    
                    var cls = new StringBuilder(256);
                    GetClassName(hWnd, cls, 256);
                    string className = cls.ToString();

                    if (!string.IsNullOrEmpty(title) && title != "Program Manager" && title != "Windows Input Experience" && className != "Shell_TrayWnd") {
                        uint pid = 0;
                        GetWindowThreadProcessId(hWnd, out pid);
                        list.Add(new WindowEntry {
                            Hwnd = hWnd.ToInt64(),
                            Pid = pid,
                            Title = title,
                            ClassName = className
                        });
                    }
                }
            }
            return true;
        }, IntPtr.Zero);

        CloseDesktop(hDesk);
        return list;
    }

    public static bool ControlWindow(string targetTitle, string subAction, string keysToSend) {
        IntPtr hDesk = OpenDesktop("default", 0, false, DESKTOP_ALL);
        if (hDesk == IntPtr.Zero) return false;

        IntPtr targetHwnd = IntPtr.Zero;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                int len = GetWindowTextLength(hWnd);
                if (len > 0) {
                    var sb = new StringBuilder(len + 1);
                    GetWindowText(hWnd, sb, sb.Capacity);
                    string t = sb.ToString();
                    if (t.IndexOf(targetTitle, StringComparison.OrdinalIgnoreCase) >= 0) {
                        targetHwnd = hWnd;
                        return false;
                    }
                }
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);

        if (targetHwnd == IntPtr.Zero) return false;

        if (subAction.Equals("close", StringComparison.OrdinalIgnoreCase)) {
            return PostMessage(targetHwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
        } else if (subAction.Equals("minimize", StringComparison.OrdinalIgnoreCase)) {
            return ShowWindow(targetHwnd, 6); // SW_MINIMIZE
        } else if (subAction.Equals("maximize", StringComparison.OrdinalIgnoreCase)) {
            return ShowWindow(targetHwnd, 3); // SW_MAXIMIZE
        } else {
            // focus or type
            ShowWindow(targetHwnd, 9); // SW_RESTORE
            SwitchToThisWindow(targetHwnd, true);
            if (!string.IsNullOrEmpty(keysToSend)) {
                Thread.Sleep(500);
                dynamic wshell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                wshell.SendKeys(keysToSend);
            }
            return true;
        }
    }

    // =============================================
    // MOUSE CONTROL
    // =============================================

    public static bool MouseMove(int x, int y) {
        return SetCursorPos(x, y);
    }

    public static bool MouseClick(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        return true;
    }

    public static bool MouseDoubleClick(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(20);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(20);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        return true;
    }

    public static bool MouseRightClick(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
        return true;
    }

    public static bool MouseScroll(int scrollClicks) {
        // scrollClicks: positive = up, negative = down, each click = 120 units
        uint amount = (uint)(scrollClicks * 120);
        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, amount, UIntPtr.Zero);
        return true;
    }

    public static bool MouseDrag(int x1, int y1, int x2, int y2) {
        DragStroke(x1, y1, x2, y2, 20);
        return true;
    }

    // =============================================
    // KEYBOARD CONTROL
    // =============================================

    public static bool TypeText(string text) {
        if (string.IsNullOrEmpty(text)) return false;
        Thread.Sleep(200);
        dynamic wshell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        // SendKeys needs special characters escaped
        string escaped = text
            .Replace("+", "{+}")
            .Replace("^", "{^}")
            .Replace("%", "{%}")
            .Replace("~", "{~}")
            .Replace("(", "{(}")
            .Replace(")", "{)}")
            .Replace("{", "{{}") 
            .Replace("}", "{}}");
        wshell.SendKeys(escaped);
        return true;
    }

    public static bool PressKey(string key) {
        if (string.IsNullOrEmpty(key)) return false;
        Thread.Sleep(100);
        dynamic wshell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        string keyCode;
        switch (key.ToLower()) {
            case "enter": keyCode = "~"; break;
            case "return": keyCode = "~"; break;
            case "tab": keyCode = "{TAB}"; break;
            case "escape": keyCode = "{ESC}"; break;
            case "esc": keyCode = "{ESC}"; break;
            case "backspace": keyCode = "{BS}"; break;
            case "delete": keyCode = "{DEL}"; break;
            case "space": keyCode = " "; break;
            case "up": keyCode = "{UP}"; break;
            case "down": keyCode = "{DOWN}"; break;
            case "left": keyCode = "{LEFT}"; break;
            case "right": keyCode = "{RIGHT}"; break;
            case "home": keyCode = "{HOME}"; break;
            case "end": keyCode = "{END}"; break;
            case "pageup": keyCode = "{PGUP}"; break;
            case "pagedown": keyCode = "{PGDN}"; break;
            case "f1": keyCode = "{F1}"; break;
            case "f2": keyCode = "{F2}"; break;
            case "f3": keyCode = "{F3}"; break;
            case "f4": keyCode = "{F4}"; break;
            case "f5": keyCode = "{F5}"; break;
            case "f11": keyCode = "{F11}"; break;
            case "f12": keyCode = "{F12}"; break;
            default: keyCode = key; break;
        }
        wshell.SendKeys(keyCode);
        return true;
    }

    public static bool HotKey(string combo) {
        if (string.IsNullOrEmpty(combo)) return false;
        Thread.Sleep(100);
        dynamic wshell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        // Translate combo like "ctrl+c" to SendKeys format "^c"
        string sendKeysCombo = combo.ToLower()
            .Replace("ctrl+", "^")
            .Replace("control+", "^")
            .Replace("alt+", "%")
            .Replace("shift+", "+")
            .Replace("win+", "^{ESC}"); // approximate
        wshell.SendKeys(sendKeysCombo);
        return true;
    }

    // =============================================
    // INTERNAL HELPERS
    // =============================================

    private static void DragStroke(int x1, int y1, int x2, int y2, int steps = 15) {
        SetCursorPos(x1, y1);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(20);

        for (int i = 1; i <= steps; i++) {
            int cx = x1 + (x2 - x1) * i / steps;
            int cy = y1 + (y2 - y1) * i / steps;
            SetCursorPos(cx, cy);
            Thread.Sleep(10);
        }

        Thread.Sleep(20);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(40);
    }

    private static void DrawCircle(int cx, int cy, int radius) {
        int startX = cx + radius;
        int startY = cy;
        SetCursorPos(startX, startY);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(20);

        for (int angle = 5; angle <= 360; angle += 10) {
            double rad = angle * Math.PI / 180.0;
            int px = cx + (int)(radius * Math.Cos(rad));
            int py = cy + (int)(radius * Math.Sin(rad));
            SetCursorPos(px, py);
            Thread.Sleep(12);
        }

        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(40);
    }

    public static bool DrawInPaint(string shape) {
        IntPtr hDesk = OpenDesktop("default", 0, false, DESKTOP_ALL);
        if (hDesk == IntPtr.Zero) {
            Console.WriteLine("OpenDesktop failed");
            return false;
        }

        SetThreadDesktop(hDesk);

        IntPtr paintHwnd = IntPtr.Zero;
        EnumDesktopWindows(hDesk, (hwnd, param) => {
            var sb = new StringBuilder(256);
            GetWindowText(hwnd, sb, sb.Capacity);
            string title = sb.ToString();
            if (title.IndexOf("Paint", StringComparison.OrdinalIgnoreCase) >= 0) {
                paintHwnd = hwnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);

        if (paintHwnd == IntPtr.Zero) {
            CloseDesktop(hDesk);
            return false;
        }

        ShowWindow(paintHwnd, 9); // SW_RESTORE
        SwitchToThisWindow(paintHwnd, true);
        Thread.Sleep(800);

        RECT rect;
        bool gr = GetWindowRect(paintHwnd, out rect);
        if (!gr) {
            CloseDesktop(hDesk);
            return false;
        }

        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;

        int cx = rect.Left + (width / 2);
        int cy = rect.Top + (height / 2) + 60;

        if (shape.Equals("circle", StringComparison.OrdinalIgnoreCase)) {
            DrawCircle(cx, cy, 90);
        } else if (shape.Equals("square", StringComparison.OrdinalIgnoreCase) || shape.Equals("box", StringComparison.OrdinalIgnoreCase)) {
            int s = 80;
            DragStroke(cx - s, cy - s, cx + s, cy - s);
            DragStroke(cx + s, cy - s, cx + s, cy + s);
            DragStroke(cx + s, cy + s, cx - s, cy + s);
            DragStroke(cx - s, cy + s, cx - s, cy - s);
        } else if (shape.Equals("star", StringComparison.OrdinalIgnoreCase)) {
            int r1 = 90;
            int r2 = 40;
            int prevX = 0, prevY = 0;
            for (int i = 0; i <= 10; i++) {
                double rad = (i * 36 - 90) * Math.PI / 180.0;
                int r = (i % 2 == 0) ? r1 : r2;
                int px = cx + (int)(r * Math.Cos(rad));
                int py = cy + (int)(r * Math.Sin(rad));
                if (i > 0) {
                    DragStroke(prevX, prevY, px, py, 8);
                }
                prevX = px;
                prevY = py;
            }
        } else if (shape.Equals("house", StringComparison.OrdinalIgnoreCase)) {
            int w = 70;
            int h = 70;
            DragStroke(cx - w, cy, cx + w, cy);
            DragStroke(cx + w, cy, cx + w, cy + h);
            DragStroke(cx + w, cy + h, cx - w, cy + h);
            DragStroke(cx - w, cy + h, cx - w, cy);
            DragStroke(cx - w, cy, cx, cy - 60);
            DragStroke(cx, cy - 60, cx + w, cy);
            DragStroke(cx - 15, cy + h, cx - 15, cy + 25);
            DragStroke(cx - 15, cy + 25, cx + 15, cy + 25);
            DragStroke(cx + 15, cy + 25, cx + 15, cy + h);
        } else {
            // Default: Happy Smiley Face
            DrawCircle(cx, cy, 90);
            DrawCircle(cx - 35, cy - 30, 12);
            DrawCircle(cx + 35, cy - 30, 12);
            int smileR = 50;
            int startX = cx - 35;
            int startY = cy + 20;
            SetCursorPos(startX, startY);
            Thread.Sleep(30);
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
            for (int angle = 30; angle <= 150; angle += 10) {
                double rad = angle * Math.PI / 180.0;
                int px = cx - (int)(smileR * Math.Cos(rad));
                int py = cy + 10 + (int)(smileR * Math.Sin(rad));
                SetCursorPos(px, py);
                Thread.Sleep(12);
            }
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        }

        CloseDesktop(hDesk);
        return true;
    }
}
'@

try {
    Add-Type -TypeDefinition $csharp -ReferencedAssemblies @("System.Core.dll", "Microsoft.CSharp.dll") -ErrorAction Stop
} catch {
    Write-Error "DesktopBridge C# compilation failed: $($_.Exception.Message)"
    exit 1
}

if ($Action -eq "list") {
    $windows = [DesktopBridge]::ListWindows()
    $json = $windows | ConvertTo-Json -Compress
    Write-Output $json
    exit 0
}

if ($Action -eq "control") {
    $res = [DesktopBridge]::ControlWindow($Target, $SubAction, $Keys)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

# =============================================
# MOUSE ACTIONS
# =============================================

if ($Action -eq "mouse_click") {
    $res = [DesktopBridge]::MouseClick([int]$X, [int]$Y)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

if ($Action -eq "mouse_doubleclick") {
    $res = [DesktopBridge]::MouseDoubleClick([int]$X, [int]$Y)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

if ($Action -eq "mouse_rightclick") {
    $res = [DesktopBridge]::MouseRightClick([int]$X, [int]$Y)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

if ($Action -eq "mouse_move") {
    $res = [DesktopBridge]::MouseMove([int]$X, [int]$Y)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

if ($Action -eq "mouse_scroll") {
    $res = [DesktopBridge]::MouseScroll([int]$Clicks)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

if ($Action -eq "mouse_drag") {
    $res = [DesktopBridge]::MouseDrag([int]$X, [int]$Y, [int]$X2, [int]$Y2)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

# =============================================
# KEYBOARD ACTIONS
# =============================================

if ($Action -eq "keyboard_type") {
    $res = [DesktopBridge]::TypeText($Keys)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

if ($Action -eq "keyboard_key") {
    $res = [DesktopBridge]::PressKey($Keys)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

if ($Action -eq "keyboard_hotkey") {
    $res = [DesktopBridge]::HotKey($Keys)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

# =============================================
# DRAW IN PAINT
# =============================================

if ($Action -eq "draw_in_paint") {
    # Ensure Paint is open on desktop
    $windows = [DesktopBridge]::ListWindows()
    $found = $false
    foreach ($w in $windows) {
        if ($w.Title -match "Paint") {
            $found = $true
            break
        }
    }
    if (-not $found) {
        Start-Process "explorer.exe" "shell:AppsFolder\Microsoft.Paint_8wekyb3d8bbwe!App"
        Start-Sleep -Milliseconds 2000
    }
    $shape = if ($Target) { $Target } else { "face" }
    $res = [DesktopBridge]::DrawInPaint($shape)
    Write-Output ($res.ToString().ToLower())
    exit 0
}

if ($Action -eq "launch_and_type") {
    # Check if target is already open
    $windows = [DesktopBridge]::ListWindows()
    $found = $false
    foreach ($w in $windows) {
        if ($w.Title -match $Target) {
            $found = $true
            break
        }
    }

    if (-not $found) {
        # Launch app
        if ($Target -match "calc") {
            Start-Process "calc.exe"
            Start-Sleep -Milliseconds 1800
        } elseif ($Target -match "notepad") {
            Start-Process "notepad.exe"
            Start-Sleep -Milliseconds 1000
        } elseif ($Target -match "explorer") {
            Start-Process "explorer.exe"
            Start-Sleep -Milliseconds 1000
        } elseif ($Target -match "paint") {
            Start-Process "explorer.exe" "shell:AppsFolder\Microsoft.Paint_8wekyb3d8bbwe!App"
            Start-Sleep -Milliseconds 2000
        } else {
            Start-Process $Target
            Start-Sleep -Milliseconds 1000
        }
    } else {
        Start-Sleep -Milliseconds 300
    }

    # Now focus and send keys
    $res = [DesktopBridge]::ControlWindow($Target, "focus", $Keys)
    Write-Output ($res.ToString().ToLower())
    exit 0
}
