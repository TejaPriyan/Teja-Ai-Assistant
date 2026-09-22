import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

function systemBridgePlugin() {
  return {
    name: "teja-system-bridge",
    configureServer(server: any) {
      const bridgeScript = path.resolve(__dirname, "scripts", "desktopBridge.ps1");

      // 1. GET /api/system/apps - Lists live open applications on user desktop
      server.middlewares.use("/api/system/apps", (_req: any, res: any) => {
        const ps = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", bridgeScript, "-Action", "list"]);
        let out = "";
        ps.stdout.on("data", (d: any) => (out += d));
        ps.on("close", () => {
          try {
            const apps = JSON.parse(out.trim() || "[]");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, apps }));
          } catch {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, apps: [] }));
          }
        });
      });

      // 2. POST /api/system/control - Focus, close, minimize, maximize, or type into any app
      server.middlewares.use("/api/system/control", (req: any, res: any) => {
        if (req.method !== "POST") return res.end();
        let body = "";
        req.on("data", (c: any) => (body += c));
        req.on("end", () => {
          try {
            const { app, action, keys } = JSON.parse(body || "{}");
            if (!app) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: "App name required" }));
            }

            const ps = spawn("powershell", [
              "-NoProfile",
              "-ExecutionPolicy",
              "Bypass",
              "-File",
              bridgeScript,
              "-Action",
              "control",
              "-Target",
              app,
              "-SubAction",
              action || "focus",
              "-Keys",
              keys || "",
            ]);

            let out = "";
            ps.stdout.on("data", (d: any) => (out += d));
            ps.on("close", () => {
              const ok = out.trim() === "true";
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  success: ok,
                  message: ok ? `Executed ${action || "focus"} on ${app}` : `Could not ${action || "focus"} ${app}`,
                })
              );
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err?.message || "Control error" }));
          }
        });
      });

      // 3. POST /api/system/launch - Launch and optionally type into desktop apps
      server.middlewares.use("/api/system/launch", (req: any, res: any) => {
        if (req.method !== "POST") return res.end();
        let body = "";
        req.on("data", (c: any) => (body += c));
        req.on("end", () => {
          try {
            const { app, args, keys } = JSON.parse(body || "{}");
            if (!app) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: "App name required" }));
            }

            const aliasMap: Record<string, { cmd: string; defaultArgs?: string[]; desktopTitle?: string }> = {
              calculator: { cmd: "calc.exe", desktopTitle: "Calculator" },
              calc: { cmd: "calc.exe", desktopTitle: "Calculator" },
              calculagter: { cmd: "calc.exe", desktopTitle: "Calculator" },
              calculater: { cmd: "calc.exe", desktopTitle: "Calculator" },
              claculator: { cmd: "calc.exe", desktopTitle: "Calculator" },
              "file manager": { cmd: "explorer.exe", desktopTitle: "File Explorer" },
              "file explorer": { cmd: "explorer.exe", desktopTitle: "File Explorer" },
              explorer: { cmd: "explorer.exe", desktopTitle: "File Explorer" },
              files: { cmd: "explorer.exe", desktopTitle: "File Explorer" },
              notepad: { cmd: "notepad.exe", desktopTitle: "Notepad" },
              chrome: { cmd: "start chrome", desktopTitle: "Chrome" },
              paint: { cmd: "explorer.exe", defaultArgs: ["shell:AppsFolder\\Microsoft.Paint_8wekyb3d8bbwe!App"], desktopTitle: "Paint" },
              mspaint: { cmd: "explorer.exe", defaultArgs: ["shell:AppsFolder\\Microsoft.Paint_8wekyb3d8bbwe!App"], desktopTitle: "Paint" },
              "task manager": { cmd: "taskmgr.exe", desktopTitle: "Task Manager" },
              taskmgr: { cmd: "taskmgr.exe", desktopTitle: "Task Manager" },
              cmd: { cmd: "cmd.exe", desktopTitle: "Command Prompt" },
              terminal: { cmd: "cmd.exe", desktopTitle: "Terminal" },
              settings: { cmd: "start ms-settings:", desktopTitle: "Settings" },
              "vs code": { cmd: "code", desktopTitle: "Visual Studio Code" },
              vscode: { cmd: "code", desktopTitle: "Visual Studio Code" },
              visual: { cmd: "code", desktopTitle: "Visual Studio Code" },
              "visual code": { cmd: "code", desktopTitle: "Visual Studio Code" },
              "visual studio code": { cmd: "code", desktopTitle: "Visual Studio Code" },
            };

            const lower = app.toLowerCase().trim();
            let executable = app;
            let execArgs = args || [];
            let targetTitle = app;

            if (aliasMap[lower]) {
              executable = aliasMap[lower].cmd;
              targetTitle = aliasMap[lower].desktopTitle || app;
              if (aliasMap[lower].defaultArgs && (!args || args.length === 0)) {
                execArgs = aliasMap[lower].defaultArgs;
              }
            }

            if (keys) {
              // Normalize keys string
              let keyString = String(keys)
                .replace(/\s*plus\s*/gi, "+")
                .replace(/\s*minus\s*/gi, "-")
                .replace(/\s*(?:times|multiplied\s+by|multiply|x)\s*/gi, "*")
                .replace(/\s*(?:divided\s+by|divide|over)\s*/gi, "/")
                .replace(/press\s*=/gi, "=")
                .replace(/\s+/g, "");

              // Format for Wscript.Shell SendKeys: escape + as {+}
              if (!keyString.includes("{+}")) {
                keyString = keyString.replace(/\+/g, "{+}");
              }
              if (!keyString.endsWith("=") && !keyString.includes("~")) {
                keyString = keyString + "=";
              }

              // Use desktopBridge to reliably launch, focus, and send keys on default desktop
              const ps = spawn("powershell", [
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                bridgeScript,
                "-Action",
                "launch_and_type",
                "-Target",
                targetTitle,
                "-Keys",
                keyString,
              ]);

              let out = "";
              ps.stdout.on("data", (d: any) => (out += d));
              ps.on("close", () => {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, message: `Launched ${targetTitle} and typed keys` }));
              });
            } else {
              const proc = spawn(executable, execArgs, {
                detached: true,
                shell: true,
                stdio: "ignore",
              });
              proc.unref();

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, message: `Launched ${app}` }));
            }
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: e?.message || "Launch error" }));
          }
        });
      });

      // 4. POST /api/system/paint/draw - Draw in MS Paint
      server.middlewares.use("/api/system/paint/draw", (req: any, res: any) => {
        if (req.method !== "POST") return res.end();
        let body = "";
        req.on("data", (c: any) => (body += c));
        req.on("end", () => {
          try {
            const { shape } = JSON.parse(body || "{}");
            const ps = spawn("powershell", [
              "-NoProfile",
              "-ExecutionPolicy",
              "Bypass",
              "-File",
              bridgeScript,
              "-Action",
              "draw_in_paint",
              "-Target",
              shape || "face",
            ]);
            let out = "";
            ps.stdout.on("data", (d: any) => (out += d));
            ps.on("close", () => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: out.includes("true"), message: `Drawn ${shape || "face"} in MS Paint` }));
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: e?.message || "Paint draw error" }));
          }
        });
      });

      server.middlewares.use("/api/system/file", (req: any, res: any) => {
        if (req.method !== "POST") return res.end();
        let body = "";
        req.on("data", (c: any) => (body += c));
        req.on("end", () => {
          try {
            const { action, filename, content, targetPath } = JSON.parse(body || "{}");
            const userHome = os.homedir();
            const defaultDir = path.join(userHome, "Desktop");

            if (action === "write_and_open") {
              const baseName = filename || "teja_notes.txt";
              const fullPath = targetPath ? path.resolve(targetPath) : path.join(defaultDir, baseName);

              const dir = path.dirname(fullPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }

              fs.writeFileSync(fullPath, content || "", "utf-8");

              const proc = spawn("notepad.exe", [fullPath], {
                detached: true,
                shell: true,
                stdio: "ignore",
              });
              proc.unref();

              res.setHeader("Content-Type", "application/json");
              return res.end(
                JSON.stringify({
                  success: true,
                  message: `Created and opened ${path.basename(fullPath)} in Notepad.`,
                  path: fullPath,
                })
              );
            }

            if (action === "open") {
              const fullPath = targetPath || defaultDir;
              const proc = spawn("explorer.exe", [fullPath], {
                detached: true,
                shell: true,
                stdio: "ignore",
              });
              proc.unref();

              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ success: true, message: `Opened ${fullPath}`, path: fullPath }));
            }

            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: "Unknown file action" }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err?.message || "File action error" }));
          }
        });
      });

      server.middlewares.use("/api/system/vscode", (req: any, res: any) => {
        if (req.method !== "POST") return res.end();
        let body = "";
        req.on("data", (c: any) => (body += c));
        req.on("end", () => {
          try {
            const { folderPath, openExplorer } = JSON.parse(body || "{}");
            const userHome = os.homedir();
            let target = folderPath ? path.resolve(folderPath) : process.cwd();

            if (!fs.existsSync(target)) {
              // Try common user directories if named
              const lower = (folderPath || "").toLowerCase();
              if (lower.includes("download")) target = path.join(userHome, "Downloads");
              else if (lower.includes("document")) target = path.join(userHome, "Documents");
              else if (lower.includes("desktop")) target = path.join(userHome, "Desktop");
              else target = process.cwd();
            }

            const codeProc = spawn("code", [target], {
              detached: true,
              shell: true,
              stdio: "ignore",
            });
            codeProc.unref();

            if (openExplorer !== false) {
              const expProc = spawn("explorer.exe", [target], {
                detached: true,
                shell: true,
                stdio: "ignore",
              });
              expProc.unref();
            }

            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                success: true,
                message: `Opened ${target} in Visual Studio Code and File Explorer`,
                target,
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err?.message || "VS Code launch error" }));
          }
        });
      });

      // =============================================
      // MOUSE CONTROL API
      // =============================================
      server.middlewares.use("/api/system/mouse", (req: any, res: any) => {
        if (req.method !== "POST") return res.end();
        let body = "";
        req.on("data", (c: any) => (body += c));
        req.on("end", () => {
          try {
            const { action, x, y, x2, y2, clicks } = JSON.parse(body || "{}");
            if (!action) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: "Action required" }));
            }

            const actionMap: Record<string, string> = {
              click: "mouse_click",
              doubleclick: "mouse_doubleclick",
              rightclick: "mouse_rightclick",
              move: "mouse_move",
              scroll: "mouse_scroll",
              drag: "mouse_drag",
            };

            const bridgeAction = actionMap[action] || `mouse_${action}`;
            const args = [
              "-NoProfile", "-ExecutionPolicy", "Bypass",
              "-File", bridgeScript,
              "-Action", bridgeAction,
              "-X", String(x || 0),
              "-Y", String(y || 0),
              "-X2", String(x2 || 0),
              "-Y2", String(y2 || 0),
              "-Clicks", String(clicks || 1),
            ];

            const ps = spawn("powershell", args);
            let out = "";
            ps.stdout.on("data", (d: any) => (out += d));
            ps.on("close", () => {
              const ok = out.trim() === "true";
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                success: ok,
                message: ok ? `Mouse ${action} at (${x}, ${y}) completed` : `Mouse ${action} failed`,
              }));
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err?.message || "Mouse control error" }));
          }
        });
      });

      // =============================================
      // KEYBOARD CONTROL API
      // =============================================
      server.middlewares.use("/api/system/keyboard", (req: any, res: any) => {
        if (req.method !== "POST") return res.end();
        let body = "";
        req.on("data", (c: any) => (body += c));
        req.on("end", () => {
          try {
            const { action, text, key, combo } = JSON.parse(body || "{}");
            if (!action) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: "Action required" }));
            }

            const actionMap: Record<string, string> = {
              type: "keyboard_type",
              key: "keyboard_key",
              hotkey: "keyboard_hotkey",
            };

            const bridgeAction = actionMap[action] || `keyboard_${action}`;
            const keysValue = text || key || combo || "";

            const ps = spawn("powershell", [
              "-NoProfile", "-ExecutionPolicy", "Bypass",
              "-File", bridgeScript,
              "-Action", bridgeAction,
              "-Keys", keysValue,
            ]);

            let out = "";
            ps.stdout.on("data", (d: any) => (out += d));
            ps.on("close", () => {
              const ok = out.trim() === "true";
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                success: ok,
                message: ok ? `Keyboard ${action} completed` : `Keyboard ${action} failed`,
              }));
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err?.message || "Keyboard control error" }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), systemBridgePlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    port: 1420,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});
