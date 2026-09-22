import type { ToolCall, AppSettings } from '../types';
import { screenCapture } from './screenCapture';

function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

export async function safeOpenUrl(url: string): Promise<{ success: boolean; popupBlocked?: boolean }> {
  if (isTauriEnv()) {
    try {
      const mod = await import(/* @vite-ignore */ '@tauri-apps/plugin-shell');
      await mod.open(url);
      return { success: true };
    } catch (err) {
      console.warn('Tauri open failed, falling back to window.open:', err);
    }
  }

  // Browser open
  try {
    const newTab = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
      return { success: false, popupBlocked: true };
    }
    return { success: true };
  } catch {
    return { success: false, popupBlocked: true };
  }
}

function normalizeUrl(url: string): string {
  let u = (url || '').trim();
  if (!/^https?:\/\//i.test(u)) {
    u = 'https://' + u;
  }
  return u;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function launchSystemApp(appCmd: string, keys?: string): Promise<{ success: boolean; message: string }> {
  // First try the local system bridge (works in browser preview via Vite)
  try {
    const res = await fetch('/api/system/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: appCmd, keys }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || `Launched ${appCmd}` };
    }
  } catch {
    // If bridge endpoint isn't available, fall back to Tauri
  }

  if (isTauriEnv()) {
    try {
      const mod = await import(/* @vite-ignore */ '@tauri-apps/plugin-shell');
      await mod.open(appCmd);
      return { success: true, message: `Launched ${appCmd} via Tauri` };
    } catch (err: any) {
      return { success: false, message: `Failed to launch ${appCmd}: ${err.message}` };
    }
  }

  return { success: false, message: `Could not launch ${appCmd}.` };
}

async function launchVsCode(folderPath?: string, openExplorer = true): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/system/vscode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, openExplorer }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message || 'Opened folder in Visual Studio Code and File Explorer' };
    }
  } catch {
    // bridge fallback
  }

  if (isTauriEnv()) {
    try {
      const mod = await import(/* @vite-ignore */ '@tauri-apps/plugin-shell');
      await mod.open(folderPath || '.');
      return { success: true, message: 'Opened folder via Tauri' };
    } catch (err: any) {
      return { success: false, message: `Failed to launch VS Code: ${err.message}` };
    }
  }

  return { success: false, message: 'Could not launch Visual Studio Code.' };
}

export async function listLiveApps(): Promise<{
  success: boolean;
  apps: Array<{ Hwnd: number; Pid: number; Title: string; ClassName: string }>;
}> {
  try {
    const res = await fetch('/api/system/apps');
    if (res.ok) {
      const data = await res.json();
      return { success: true, apps: data.apps || [] };
    }
  } catch {}
  return { success: false, apps: [] };
}

export async function controlLiveApp(
  app: string,
  action = 'focus',
  keys?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/system/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, action, keys }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: data.success ?? true, message: data.message || `Controlled ${app}` };
    }
  } catch {}
  return { success: false, message: `Could not ${action} ${app}` };
}

export async function drawInPaint(shape = 'face'): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const res = await fetch('/api/system/paint/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shape }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: data.success ?? true, message: data.message || `Drawn ${shape} in Paint` };
    }
  } catch (err: any) {
    return { success: false, message: 'Could not draw in Paint', error: err?.message };
  }
  return { success: false, message: 'Could not draw in Paint' };
}

export function evaluateMath(expression: string): { expression: string; result: number; keysStr: string } | null {
  try {
    let expr = (expression || '').toLowerCase().trim();
    // Replace spoken math words
    expr = expr
      .replace(/\s*plus\s*/gi, '+')
      .replace(/\s*minus\s*/gi, '-')
      .replace(/\s*(?:times|multiplied\s+by|multiply|x)\s*/gi, '*')
      .replace(/\s*(?:divided\s+by|divide|over)\s*/gi, '/')
      .replace(/\s*press\s*=/gi, '')
      .replace(/=/g, '')
      .trim();

    // Sanitize: allow only numbers, spaces, and operators + - * / . ( ) %
    const sanitized = expr.replace(/[^0-9+\-*/.() %]/g, '').trim();
    if (!sanitized) return null;

    // Evaluate safely
    // eslint-disable-next-line no-new-func
    const calcFn = new Function(`'use strict'; return (${sanitized});`);
    const val = calcFn();
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return null;

    // Key sequence: escape + to {+} and append =
    const keysStr = sanitized.replace(/\+/g, '{+}') + '=';
    return {
      expression: sanitized,
      result: Math.round(val * 10000) / 10000,
      keysStr,
    };
  } catch {
    return null;
  }
}

async function handleFileAction(action: string, payload: any): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/system/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message };
    }
  } catch {
    // bridge fallback
  }

  if (isTauriEnv()) {
    try {
      const mod = await import(/* @vite-ignore */ '@tauri-apps/plugin-shell');
      if (payload.targetPath) {
        await mod.open(payload.targetPath);
        return { success: true, message: `Opened ${payload.targetPath}` };
      }
    } catch {}
  }

  return { success: false, message: 'File action completed.' };
}

export async function executeTool(
  tool: ToolCall,
  settings: AppSettings,
  onPendingUrl?: (info: { label: string; url: string } | null) => void,
  onLiveScreenToggle?: (active: boolean) => void
): Promise<{ success: boolean; message: string; speechResponse?: string }> {
  try {
    switch (tool.name) {
      case 'open_website': {
        let url = tool.parameters.url || '';
        const shortcuts: Record<string, string> = {
          youtube: 'https://youtube.com',
          google: 'https://google.com',
          gmail: 'https://mail.google.com',
          github: 'https://github.com',
          x: 'https://x.com',
          twitter: 'https://x.com',
          netflix: 'https://netflix.com',
          stackoverflow: 'https://stackoverflow.com',
          spotify: 'https://open.spotify.com',
        };

        const cleanKey = url
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/www\./, '')
          .replace(/\..*/, '')
          .trim();
        if (shortcuts[cleanKey] && !url.includes('.')) {
          url = shortcuts[cleanKey];
        }

        url = normalizeUrl(url);
        if (!isValidUrl(url)) {
          return { success: false, message: `Invalid URL: ${url}` };
        }

        const openResult = await safeOpenUrl(url);
        if (openResult.popupBlocked) {
          onPendingUrl?.({ label: `Click here to open ${url}`, url });
          return {
            success: true,
            message: `Opening ${url}. (Click open tab banner if popup was blocked).`,
            speechResponse: `Opening ${cleanKey || 'the website'}.`,
          };
        }

        onPendingUrl?.(null);
        return {
          success: true,
          message: `Opening ${url}`,
          speechResponse: `Opening ${cleanKey || 'the website'}.`,
        };
      }

      case 'web_search': {
        const query = (tool.parameters.query || '').trim();
        if (!query) return { success: false, message: 'No search query provided' };
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        await safeOpenUrl(searchUrl);
        return {
          success: true,
          message: `Searching Google for "${query}"`,
          speechResponse: `Searching Google for ${query}.`,
        };
      }

      case 'calculate_in_app': {
        const rawExpr =
          tool.parameters.expression ||
          tool.parameters.math ||
          tool.parameters.query ||
          tool.parameters.calculation ||
          '';
        const calcRes = evaluateMath(rawExpr);

        if (calcRes) {
          await launchSystemApp('calc.exe', calcRes.keysStr);
          return {
            success: true,
            message: `Calculated ${calcRes.expression} = ${calcRes.result}. Opened Calculator and entered values.`,
            speechResponse: `${calcRes.expression} equals ${calcRes.result}. I've entered it in your Calculator.`,
          };
        } else {
          await launchSystemApp('calc.exe');
          return {
            success: true,
            message: 'Opened Calculator on your PC.',
            speechResponse: 'Opening Calculator.',
          };
        }
      }

      case 'youtube_search': {
        const query = (tool.parameters.query || tool.parameters.search || '').trim();
        const ytUrl = query
          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
          : 'https://youtube.com';

        const openResult = await safeOpenUrl(ytUrl);
        if (openResult.popupBlocked) {
          onPendingUrl?.({ label: `Click here to open YouTube for "${query}"`, url: ytUrl });
        } else {
          onPendingUrl?.(null);
        }

        return {
          success: true,
          message: query ? `Opened YouTube and typed search for "${query}".` : 'Opened YouTube.',
          speechResponse: query ? `Going to YouTube and typing ${query}.` : 'Opening YouTube.',
        };
      }

      case 'open_in_vscode': {
        const folderPath = tool.parameters.folder_path || tool.parameters.folder || tool.parameters.path || '.';
        const openExplorer = tool.parameters.open_explorer !== false;
        const res = await launchVsCode(folderPath, openExplorer);
        return {
          success: res.success,
          message: res.message,
          speechResponse: 'Opening File Explorer and Visual Studio Code for your folder.',
        };
      }

      case 'draw_in_paint': {
        const shape = tool.parameters.shape || 'face';
        const res = await drawInPaint(shape);
        return {
          success: res.success,
          message: res.success
            ? `Opened MS Paint and drew a ${shape} on the canvas.`
            : `Opened MS Paint. Could not complete drawing: ${res.error || 'unknown error'}`,
          speechResponse: `I've opened Paint and drawn a ${shape} for you.`,
        };
      }

      case 'list_live_apps': {
        const res = await listLiveApps();
        if (res.success && res.apps.length > 0) {
          const names = Array.from(new Set(res.apps.map((a) => a.Title).filter(Boolean)));
          const listText = names.map((n) => `• ${n}`).join('\n');
          return {
            success: true,
            message: `Currently Active Applications (${names.length}):\n${listText}`,
            speechResponse: `You have ${names.length} applications open: ${names.slice(0, 4).join(', ')}.`,
          };
        }
        return {
          success: true,
          message: 'No open user application windows were detected on your desktop.',
          speechResponse: 'I did not find any active user windows running on your desktop.',
        };
      }

      case 'control_live_app': {
        const appName = tool.parameters.app_name || tool.parameters.app || tool.parameters.target || '';
        const action = (tool.parameters.action || 'focus').toLowerCase();
        const keys = tool.parameters.keys || tool.parameters.text || '';

        if (!appName) return { success: false, message: 'No application name specified' };

        const res = await controlLiveApp(appName, action, keys);
        const actionLabel =
          action === 'close'
            ? 'Closed'
            : action === 'minimize'
            ? 'Minimized'
            : action === 'maximize'
            ? 'Maximized'
            : action === 'type'
            ? 'Typed into'
            : 'Switched to';

        return {
          success: res.success,
          message: res.message || `${actionLabel} ${appName}.`,
          speechResponse: `${actionLabel} ${appName}.`,
        };
      }

      case 'open_application': {
        const rawName = (tool.parameters.app_name || '').toLowerCase().trim();
        if (!rawName) return { success: false, message: 'No application name specified' };

        // Check if math/keys was passed with calculator
        if (/calcula|calculagter|calculator|calc/i.test(rawName) && (tool.parameters.keys || tool.parameters.expression)) {
          const calcRes = evaluateMath(tool.parameters.expression || tool.parameters.keys);
          if (calcRes) {
            await launchSystemApp('calc.exe', calcRes.keysStr);
            return {
              success: true,
              message: `Calculated ${calcRes.expression} = ${calcRes.result}. Opened Calculator and entered values.`,
              speechResponse: `${calcRes.expression} equals ${calcRes.result}. I've entered it in your Calculator.`,
            };
          }
        }

        // Check if VS Code
        if (/vs\s*code|vscode|visual\s*code|visual\s*studio\s*code|code/i.test(rawName)) {
          const res = await launchVsCode(tool.parameters.folder_path || '.', true);
          return {
            success: res.success,
            message: res.message,
            speechResponse: 'Opening Visual Studio Code and File Explorer.',
          };
        }

        // Normalize known app names & common typos
        let appTarget = rawName;
        let displayName = rawName;

        if (/calcula|calculagter|calculater|calculator|calc/i.test(rawName)) {
          appTarget = 'calc.exe';
          displayName = 'Calculator';
        } else if (/file\s*explorer|file\s*manager|explorer|files|my\s*files|windows\s*explorer/i.test(rawName)) {
          appTarget = 'explorer.exe';
          displayName = 'File Explorer';
        } else if (/notepad|text\s*editor|notes/i.test(rawName)) {
          appTarget = 'notepad.exe';
          displayName = 'Notepad';
        } else if (/paint|mspaint/i.test(rawName)) {
          appTarget = 'paint';
          displayName = 'Paint';
        } else if (/task\s*manager|taskmgr/i.test(rawName)) {
          appTarget = 'taskmgr.exe';
          displayName = 'Task Manager';
        } else if (/terminal|cmd|command\s*prompt|powershell/i.test(rawName)) {
          appTarget = 'cmd.exe';
          displayName = 'Terminal';
        } else if (/settings/i.test(rawName)) {
          appTarget = 'start ms-settings:';
          displayName = 'Settings';
        } else if (/chrome|google\s*chrome/i.test(rawName)) {
          appTarget = 'start chrome';
          displayName = 'Google Chrome';
        } else if (/spotify/i.test(rawName)) {
          appTarget = 'spotify';
          displayName = 'Spotify';
        }

        const launchRes = await launchSystemApp(appTarget, tool.parameters.keys);
        if (launchRes.success) {
          return {
            success: true,
            message: `Opened ${displayName} on your PC.`,
            speechResponse: `Opening ${displayName}.`,
          };
        }

        return {
          success: false,
          message: `I couldn't open "${rawName}". You can add its path in Settings.`,
        };
      }

      case 'open_file': {
        const targetPath = tool.parameters.path || tool.parameters.file_path || '';
        const res = await handleFileAction('open', { targetPath });
        return {
          success: res.success,
          message: res.message,
          speechResponse: `Opening ${targetPath || 'File Explorer'}.`,
        };
      }

      case 'write_and_open_file': {
        const filename = tool.parameters.filename || 'teja_notes.txt';
        const content = tool.parameters.content || tool.parameters.text || '';
        const targetPath = tool.parameters.path;

        const res = await handleFileAction('write_and_open', {
          filename,
          content,
          targetPath,
        });

        return {
          success: res.success,
          message: res.message || `Wrote content to ${filename} and opened in Notepad.`,
          speechResponse: `I created ${filename}, typed your content, and opened it in Notepad.`,
        };
      }

      case 'start_live_screen': {
        const res = await screenCapture.startLiveStream();
        if (res.stream) {
          onLiveScreenToggle?.(true);
          return {
            success: true,
            message: 'Continuous Live Screen Vision is now active. I am seeing your screen live!',
            speechResponse: 'Continuous Live Screen Vision is now active! I can see your screen in real time.',
          };
        }
        return {
          success: false,
          message: res.error || 'Could not start live screen stream.',
          speechResponse: 'Screen sharing was cancelled or denied.',
        };
      }

      case 'capture_screen': {
        const question = tool.parameters.question || '';
        const capture = await screenCapture.captureScreenFrame();
        if (!capture.imageBase64) {
          return {
            success: false,
            message: capture.error || 'Screen capture was cancelled or failed.',
            speechResponse: 'I could not access your screen. Please make sure screen sharing permission is granted.',
          };
        }

        const analysis = await screenCapture.analyzeScreen(question, capture.imageBase64, settings);
        return {
          success: true,
          message: analysis,
          speechResponse: analysis,
        };
      }

      case 'get_system_info': {
        let info = `Browser: ${navigator.userAgent.split(' ').slice(-1)[0]}, Platform: ${navigator.platform}`;
        if (isTauriEnv()) {
          try {
            const os = await import(/* @vite-ignore */ '@tauri-apps/plugin-os');
            const platform = await os.platform();
            const arch = await os.arch();
            const osType = await os.type();
            const version = await os.version();
            info = `OS: ${osType} ${version}, Platform: ${platform}, Arch: ${arch}, Cores: ${navigator.hardwareConcurrency}`;
          } catch {}
        }
        return { success: true, message: info, speechResponse: `System specs: ${info}` };
      }

      // =============================================
      // MOUSE CONTROL
      // =============================================

      case 'mouse_click': {
        const x = tool.parameters.x ?? 0;
        const y = tool.parameters.y ?? 0;
        const button = (tool.parameters.button || 'left').toLowerCase();
        const { computerControl } = await import('./computerControl');

        let res;
        if (button === 'double') {
          res = await computerControl.mouseDoubleClick(x, y);
        } else if (button === 'right') {
          res = await computerControl.mouseRightClick(x, y);
        } else {
          res = await computerControl.mouseClick(x, y);
        }
        return {
          success: res.success,
          message: res.message,
          speechResponse: `Clicked at position ${x}, ${y}.`,
        };
      }

      case 'mouse_scroll': {
        const direction = (tool.parameters.direction || 'down').toLowerCase();
        const scrollClicks = tool.parameters.clicks || 3;
        const { computerControl } = await import('./computerControl');
        const res = await computerControl.mouseScroll(direction as 'up' | 'down', scrollClicks);
        return {
          success: res.success,
          message: res.message,
          speechResponse: `Scrolled ${direction}.`,
        };
      }

      // =============================================
      // KEYBOARD CONTROL
      // =============================================

      case 'keyboard_type': {
        const text = tool.parameters.text || '';
        if (!text) return { success: false, message: 'No text to type' };
        const { computerControl } = await import('./computerControl');
        const res = await computerControl.typeText(text);
        return {
          success: res.success,
          message: res.message,
          speechResponse: `Typed the text.`,
        };
      }

      case 'keyboard_key': {
        const key = tool.parameters.key || '';
        if (!key) return { success: false, message: 'No key specified' };
        const { computerControl } = await import('./computerControl');
        const res = await computerControl.pressKey(key);
        return {
          success: res.success,
          message: res.message,
          speechResponse: `Pressed ${key}.`,
        };
      }

      case 'keyboard_hotkey': {
        const combo = tool.parameters.combo || '';
        if (!combo) return { success: false, message: 'No key combo specified' };
        const { computerControl } = await import('./computerControl');
        const res = await computerControl.hotKey(combo);
        return {
          success: res.success,
          message: res.message,
          speechResponse: `Pressed ${combo}.`,
        };
      }

      // =============================================
      // SCREEN VISION + CLICK (ANALYZE AND CLICK)
      // =============================================

      case 'analyze_and_click': {
        const elementDesc = tool.parameters.element_description || '';
        const clickType = (tool.parameters.click_type || 'left').toLowerCase();
        if (!elementDesc) return { success: false, message: 'No element description provided' };

        // 1. Capture current screen
        const capture = await screenCapture.captureScreenFrame();
        if (!capture.imageBase64) {
          return {
            success: false,
            message: capture.error || 'Could not capture screen for element detection.',
            speechResponse: 'I could not access the screen to find that element.',
          };
        }

        // 2. Use vision AI to find the element coordinates
        const openRouterKey = settings.ai.apiKeyOpenRouter;
        if (!openRouterKey) {
          return {
            success: false,
            message: 'OpenRouter API key required for screen element detection. Add it in Settings.',
            speechResponse: 'I need the OpenRouter API key to see and find screen elements.',
          };
        }

        try {
          const visionPrompt = `Look at this screenshot of a Windows desktop. Find the UI element described as: "${elementDesc}". 
Return ONLY a JSON object with the approximate center coordinates of that element in the format: {"x": number, "y": number, "found": true, "description": "what you found"}
If you cannot find the element, return: {"found": false, "reason": "why not found"}
Do NOT include any other text, explanation, or markdown. Just the JSON.`;

          const candidateModels = [
            'google/gemma-4-31b-it:free',
            'google/gemma-4-26b-a4b-it:free',
            'qwen/qwen3.8-27b:free',
          ];

          for (const model of candidateModels) {
            try {
              const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openRouterKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model,
                  messages: [
                    {
                      role: 'user',
                      content: [
                        { type: 'text', text: visionPrompt },
                        { type: 'image_url', image_url: { url: capture.imageBase64 } },
                      ],
                    },
                  ],
                  max_tokens: 200,
                }),
              });

              if (resp.ok) {
                const data = await resp.json();
                const answer = data.choices?.[0]?.message?.content?.trim();
                if (answer) {
                  // Parse JSON from response
                  const jsonMatch = answer.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.found && parsed.x != null && parsed.y != null) {
                      // 3. Click at the coordinates
                      const { computerControl } = await import('./computerControl');
                      let clickRes;
                      if (clickType === 'double') {
                        clickRes = await computerControl.mouseDoubleClick(parsed.x, parsed.y);
                      } else if (clickType === 'right') {
                        clickRes = await computerControl.mouseRightClick(parsed.x, parsed.y);
                      } else {
                        clickRes = await computerControl.mouseClick(parsed.x, parsed.y);
                      }
                      return {
                        success: clickRes.success,
                        message: `Found "${parsed.description || elementDesc}" and clicked at (${parsed.x}, ${parsed.y}).`,
                        speechResponse: `Found and clicked ${elementDesc}.`,
                      };
                    } else {
                      return {
                        success: false,
                        message: `Could not find "${elementDesc}" on screen. ${parsed.reason || ''}`,
                        speechResponse: `I couldn't find ${elementDesc} on the screen.`,
                      };
                    }
                  }
                }
              }
            } catch {
              // try next model
            }
          }

          return {
            success: false,
            message: `Could not analyze screen to find "${elementDesc}".`,
            speechResponse: `I had trouble analyzing the screen to find that element.`,
          };
        } catch (err: any) {
          return {
            success: false,
            message: `Screen analysis error: ${err?.message || 'unknown'}`,
            speechResponse: 'There was an error analyzing the screen.',
          };
        }
      }

      default:
        return { success: false, message: `Unknown tool: ${tool.name}` };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Tool execution failed' };
  }
}
