import type { AIResponse, AppSettings, ToolCall } from '../types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are TEJA AI, a futuristic personal desktop AI assistant with FULL COMPUTER CONTROL. You are helpful, concise, intelligent, and friendly. You are in a LIVE CONVERSATION with the user — maintain context across messages.

You can control the user's Windows computer using mouse, keyboard, and screen vision. When the user asks you to do something on the computer, you MUST call the appropriate tool. Do NOT just describe what to do — actually DO it.

TOOL USAGE GUIDE:
- To click anywhere on screen (buttons, links, icons): use mouse_click with coordinates, OR use analyze_and_click with a description of what to click.
- To scroll the page/window: use mouse_scroll.
- To type text (in search boxes, text fields, etc.): use keyboard_type.
- To press special keys (Enter, Tab, Escape, etc.): use keyboard_key.
- To use keyboard shortcuts (Ctrl+C, Ctrl+V, Alt+Tab, etc.): use keyboard_hotkey.
- To see/list all currently open/running desktop apps: use list_live_apps.
- To switch to, focus, close, minimize, maximize, or type into any running app: use control_live_app.
- To open MS Paint and draw something: use draw_in_paint.
- To open a website: use open_website.
- To open YouTube and search: use youtube_search.
- To calculate math in Calculator: use calculate_in_app.
- To open a folder in VS Code: use open_in_vscode.
- To search the web: use web_search.
- To open PC apps (Calculator, Notepad, Chrome, etc.): use open_application.
- To open a file or folder: use open_file.
- To create a file with text and open it: use write_and_open_file.
- To start live screen vision: use start_live_screen.
- To capture and analyze the screen: use capture_screen.
- To look at screen and click a specific element: use analyze_and_click.
- For general questions: answer directly in 1-3 conversational sentences.

IMPORTANT RULES:
- Maintain conversational context. If the user says "the first one" or "that button", understand from context.
- For complex tasks, break them into steps and execute each one.
- For destructive actions (file deletion, sending messages), ask for confirmation first.
- Keep responses SHORT and natural — like a phone call.
- After completing an action, report briefly: "Done.", "Opening Chrome.", etc.`;

export const AVAILABLE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'draw_in_paint',
      description: 'Opens MS Paint and automatically draws a shape or drawing on the canvas (e.g. face/smiley, circle, square, star, house)',
      parameters: {
        type: 'object',
        properties: {
          shape: {
            type: 'string',
            enum: ['face', 'circle', 'square', 'star', 'house'],
            description: 'The shape or drawing to create in MS Paint',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_live_apps',
      description: 'Lists all active application windows currently open on the user desktop',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'control_live_app',
      description: 'Controls an active application on the user desktop (focus, close, minimize, maximize, or type keys into it)',
      parameters: {
        type: 'object',
        properties: {
          app_name: {
            type: 'string',
            description: 'The name or window title of the target application, e.g. "Calculator", "Notepad", "Chrome"',
          },
          action: {
            type: 'string',
            enum: ['focus', 'close', 'minimize', 'maximize', 'type'],
            description: 'Action to perform on the application window',
          },
          keys: {
            type: 'string',
            description: 'Optional keystrokes to type into the application if action is type',
          },
        },
        required: ['app_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_in_app',
      description: 'Calculates a math expression (e.g. 98 + 77), opens Windows Calculator, and enters/types the calculation into Calculator to display the answer',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'The math expression to compute and type into Calculator, e.g. "98 + 77"',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'youtube_search',
      description: 'Opens YouTube and types the search query directly into the YouTube search bar to show results',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The query, name, song, or topic to type into YouTube search',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_in_vscode',
      description: 'Opens a specified folder (or current project directory) in Visual Studio Code and File Explorer',
      parameters: {
        type: 'object',
        properties: {
          folder_path: {
            type: 'string',
            description: 'The path or folder name to open in VS Code (e.g. current project, downloads, documents, desktop)',
          },
          open_explorer: {
            type: 'boolean',
            description: 'Whether to also open File Explorer for the folder (defaults to true)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_website',
      description: 'Opens a website URL in the browser. Always use full URL starting with https://',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL or web address to open, e.g. https://youtube.com',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Searches the web using Google for current information, news, or answers',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search keywords or question',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_application',
      description: 'Opens a known desktop application on the PC (Calculator, File Manager, Notepad, Paint, Task Manager, Chrome, VS Code, Spotify)',
      parameters: {
        type: 'object',
        properties: {
          app_name: {
            type: 'string',
            description: 'Name of the application to launch (e.g. calculator, file manager, notepad, paint, vs code)',
          },
        },
        required: ['app_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_file',
      description: 'Opens a file or folder on the user computer in File Explorer or default application',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path or name of the file or folder to open',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_and_open_file',
      description: 'Creates a file, types text into it, and opens it on screen in Notepad',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Name of the file to create, e.g. notes.txt',
          },
          content: {
            type: 'string',
            description: 'The text content to write into the file',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_live_screen',
      description: 'Starts continuous live screen vision streaming so the AI can see the screen in real-time',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'capture_screen',
      description: 'Captures and visually analyzes what is currently displayed on the user screen or open windows',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'What the user wants to understand about their screen',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mouse_click',
      description: 'Clicks the mouse at specific screen coordinates (x, y). Use when you know the exact position to click.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate on screen' },
          y: { type: 'number', description: 'Y coordinate on screen' },
          button: { type: 'string', enum: ['left', 'right', 'double'], description: 'Mouse button to click (default: left)' },
        },
        required: ['x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mouse_scroll',
      description: 'Scrolls the mouse wheel up or down',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
          clicks: { type: 'number', description: 'Number of scroll clicks (default: 3)' },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'keyboard_type',
      description: 'Types text using the keyboard. Use for filling forms, search boxes, typing in editors, etc.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text to type' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'keyboard_key',
      description: 'Presses a special key (Enter, Tab, Escape, Backspace, Delete, arrows, F1-F12, etc.)',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Key name: enter, tab, escape, backspace, delete, up, down, left, right, f1-f12, home, end, pageup, pagedown, space' },
        },
        required: ['key'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'keyboard_hotkey',
      description: 'Presses a keyboard shortcut combination (e.g. ctrl+c, ctrl+v, alt+tab, ctrl+a, ctrl+shift+n)',
      parameters: {
        type: 'object',
        properties: {
          combo: { type: 'string', description: 'Key combination, e.g. "ctrl+c", "alt+tab", "ctrl+shift+n"' },
        },
        required: ['combo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_and_click',
      description: 'Captures the current screen, uses AI vision to find a described element, and clicks it. Use when you need to click something by description rather than coordinates (e.g. "the blue button", "the first video", "the search box").',
      parameters: {
        type: 'object',
        properties: {
          element_description: { type: 'string', description: 'Description of the UI element to find and click, e.g. "the search box", "the first video thumbnail", "the download button"' },
          click_type: { type: 'string', enum: ['left', 'right', 'double'], description: 'Type of click (default: left)' },
        },
        required: ['element_description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_system_info',
      description: 'Returns hardware and OS platform specifications',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

function cleanText(text: string): string {
  let t = text || '';
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  t = t.replace(/<\|[a-z_]+\|>[\s\S]*?<\/[a-z_]+\|>/gi, '');
  t = t.replace(/```json[\s\S]*?```/gi, '');
  return t.trim();
}

// Fallback intent detector for direct queries if LLM doesn't call tool natively
function detectFallbackIntent(query: string): ToolCall | null {
  // Strip trailing "over" conclusion keyword
  const q = query.toLowerCase().replace(/\b(?:over)\b[.!?]?\s*$/i, '').trim();

  // 1. Live Apps Inspection Intent
  if (
    q.includes('what apps are open') ||
    q.includes('what apps are running') ||
    q.includes('see all live apps') ||
    q.includes('see all apps') ||
    q.includes('see live apps') ||
    q.includes('list live apps') ||
    q.includes('list all apps') ||
    q.includes('show running apps') ||
    q.includes('show open apps') ||
    q.includes('see all open windows') ||
    q.includes('check live apps')
  ) {
    return {
      name: 'list_live_apps',
      parameters: {},
    };
  }

  // 2. Control Live App (Close, Focus/Switch, Minimize, Maximize)
  const closeMatch = q.match(/^(?:close|quit|kill|exit)\s+(.+)$/i);
  if (closeMatch) {
    return {
      name: 'control_live_app',
      parameters: { app_name: closeMatch[1].trim(), action: 'close' },
    };
  }

  const focusMatch = q.match(/^(?:switch\s+to|focus|bring\s+up|go\s+to\s+app)\s+(.+)$/i);
  if (focusMatch) {
    return {
      name: 'control_live_app',
      parameters: { app_name: focusMatch[1].trim(), action: 'focus' },
    };
  }

  const minMatch = q.match(/^minimize\s+(.+)$/i);
  if (minMatch) {
    return {
      name: 'control_live_app',
      parameters: { app_name: minMatch[1].trim(), action: 'minimize' },
    };
  }

  const maxMatch = q.match(/^maximize\s+(.+)$/i);
  if (maxMatch) {
    return {
      name: 'control_live_app',
      parameters: { app_name: maxMatch[1].trim(), action: 'maximize' },
    };
  }

  // 3. Continuous Live Screen Intent
  if (
    q.includes('live screen') ||
    q.includes('start live vision') ||
    q.includes('show screen live') ||
    q.includes('keep screen live') ||
    q.includes('stream my screen') ||
    q.includes('continuous screen') ||
    q.includes('continues screen') ||
    q.includes('show the screen to the ai like live')
  ) {
    return {
      name: 'start_live_screen',
      parameters: {},
    };
  }

  // 4. Screen Vision Frame Query
  if (
    q.includes('see my screen') ||
    q.includes('look at my screen') ||
    q.includes('whats on my screen') ||
    q.includes("what's on my screen") ||
    q.includes('capture screen') ||
    q.includes('check my screen') ||
    q.includes('read my screen') ||
    q.includes('see the screen') ||
    q.includes('see the whole screen')
  ) {
    return {
      name: 'capture_screen',
      parameters: { question: query },
    };
  }

  // 5. Draw in MS Paint
  // e.g. "open paint and draw something", "open paint and draw a circle", "draw a star in paint", "draw a house"
  if (
    /(?:open\s+)?(?:paint|mspaint).*?(?:draw|sketch|paint)\s*(.*)/i.test(q) ||
    /draw\s+(?:a\s+|an\s+)?(circle|square|star|house|face|box|something|picture|drawing)?(?:\s+in\s+paint)?/i.test(q) ||
    /paint\s+(?:a\s+|an\s+)?(circle|square|star|house|face|box|something|picture|drawing)?/i.test(q)
  ) {
    let shape = 'face';
    if (q.includes('circle')) shape = 'circle';
    else if (q.includes('square') || q.includes('box')) shape = 'square';
    else if (q.includes('star')) shape = 'star';
    else if (q.includes('house')) shape = 'house';
    return {
      name: 'draw_in_paint',
      parameters: { shape },
    };
  }

  // 6. Calculator with typing / calculations:
  // e.g. "open calculater and tell type 98 plus 77 press =", "type 98 plus 77 press =", "calculate 98 + 77", "open calculator and type"
  const calcMathMatch =
    q.match(/(?:type|calculate|compute|solve)\s+([0-9\s.+*x=plusminustimesdividedby/-]+)(?:\s*(?:press|=).*?)?$/i) ||
    q.match(/(?:open\s+)?(?:the\s+)?(?:calc|calculator|calculagter|calculater|claculator)\s+(?:and\s+)?(?:tell\s+)?(?:type\s+)?([0-9\s.+*x=plusminustimesdividedby/-]+)(?:\s*(?:press|=).*?)?$/i) ||
    q.match(/\b([0-9]+)\s*(?:\+|-|plus|minus|\*|x|times|\/|divided\s+by)\s*([0-9]+)(?:\s*(?:press\s*)?=?.*)?$/i);

  if (calcMathMatch) {
    let expr = calcMathMatch[1];
    if (calcMathMatch[2]) {
      expr = calcMathMatch[0].replace(/press\s*=?/gi, '').replace(/it\s*should.*/gi, '').trim();
    }
    expr = expr.replace(/press\s*=?/gi, '').replace(/it\s*should.*/gi, '').trim();
    if (expr && /[0-9]/.test(expr)) {
      return {
        name: 'calculate_in_app',
        parameters: { expression: expr },
      };
    }
  }

  // If user says "open calculator and type" without specific numbers, default to a sample calculation
  if (/(?:open\s+)?(?:the\s+)?(?:calc|calculator|calculagter|calculater|claculator).*?type/i.test(q)) {
    return {
      name: 'calculate_in_app',
      parameters: { expression: '98 + 77' },
    };
  }

  // 7. YouTube search / typing query
  // e.g. "go to youtube after type any name in you tube", "go to youtube and type lofi music", "type song in youtube"
  const ytTypeMatch =
    q.match(/(?:go\s+to|open)\s+you\s*tube\s+(?:and|after|then)\s+(?:type|search(?:\s+for)?)\s+(.+?)(?:\s+in\s+you\s*tube)?$/i) ||
    q.match(/type\s+(.+?)\s+in\s+you\s*tube$/i) ||
    q.match(/search\s+(.+?)\s+on\s+you\s*tube$/i);

  if (ytTypeMatch) {
    const query = ytTypeMatch[1].trim();
    return {
      name: 'youtube_search',
      parameters: { query },
    };
  }

  // 8. Visual Studio Code + File Explorer
  // e.g. "open file explorer and open that folder in visual", "open that folder in visual code", "open in visual"
  if (
    /(?:open\s+)?(?:file\s*explorer|explorer)?.*?(?:and\s+)?open\s+(?:that|the|this)?\s*(?:folder|project|directory)?\s*(?:in\s+)?(?:visual\s*studio\s*code|visual\s*code|vscode|visual)/i.test(q) ||
    /open\s+(?:that|the|this)?\s*folder\s+in\s+(?:visual|code)/i.test(q)
  ) {
    return {
      name: 'open_in_vscode',
      parameters: { folder_path: '.', open_explorer: true },
    };
  }

  // 9. Plain Calculator (handles typos like "calculagter", "calculater", "claculator")
  if (
    /\b(?:open\s+)?(?:the\s+)?(?:calc|calculator|calculagter|calculater|claculator)\b/i.test(q) &&
    !q.includes('what is') &&
    !q.includes('calculate') &&
    !q.includes('type')
  ) {
    return {
      name: 'open_application',
      parameters: { app_name: 'calculator' },
    };
  }

  // 7. Plain File Manager / File Explorer
  if (
    /\b(?:open\s+)?(?:the\s+)?(?:file\s*manager|file\s*explorer|explorer|my\s*files|windows\s*explorer)\b/i.test(q)
  ) {
    return {
      name: 'open_application',
      parameters: { app_name: 'file manager' },
    };
  }

  // 8. Open file and type this
  // e.g. "open that file and type hello world", "type hello in test.txt", "open file and type ..."
  const fileTypeMatch = q.match(/(?:open\s+(?:that\s+)?file\s+(?:and\s+)?type\s+|type\s+)(.+?)(?:\s+in\s+([a-z0-9_.-]+\.[a-z0-9]+))?$/i);
  if (fileTypeMatch) {
    const textToType = fileTypeMatch[1].trim();
    const fileName = fileTypeMatch[2] ? fileTypeMatch[2].trim() : 'teja_notes.txt';
    return {
      name: 'write_and_open_file',
      parameters: {
        filename: fileName,
        content: textToType,
      },
    };
  }

  // 9. Visual Studio Code standalone
  if (/\b(?:open|launch)\s+(?:vs\s*code|vscode|visual\s*code|visual\s*studio\s*code|visual)\b/i.test(q)) {
    return {
      name: 'open_in_vscode',
      parameters: { folder_path: '.', open_explorer: true },
    };
  }

  // 10. Other desktop apps (Notepad, Paint, Task Manager, Terminal, Chrome, Spotify)
  const appMatch = q.match(/^(?:open|launch)\s+(notepad|paint|mspaint|task\s*manager|cmd|terminal|chrome|spotify|discord)$/i);
  if (appMatch) {
    return {
      name: 'open_application',
      parameters: { app_name: appMatch[1] },
    };
  }

  // 11. Open website shortcuts
  const webMatch = q.match(/^(?:open|launch|go to|visit)\s+(youtube|google|gmail|github|twitter|netflix|spotify|chatgpt|reddit|linkedin|amazon|wikipedia)(?:\.com)?$/i);
  if (webMatch) {
    const site = webMatch[1].toLowerCase();
    const siteMap: Record<string, string> = {
      youtube: 'https://youtube.com',
      google: 'https://google.com',
      gmail: 'https://mail.google.com',
      github: 'https://github.com',
      twitter: 'https://x.com',
      netflix: 'https://netflix.com',
      spotify: 'https://open.spotify.com',
      chatgpt: 'https://chat.openai.com',
      reddit: 'https://reddit.com',
      linkedin: 'https://linkedin.com',
      amazon: 'https://amazon.com',
      wikipedia: 'https://wikipedia.org',
    };
    return {
      name: 'open_website',
      parameters: { url: siteMap[site] || `https://${site}.com` },
    };
  }

  // 12. Generic URL pattern
  const urlMatch = q.match(/^(?:open|go to|visit)\s+(https?:\/\/[^\s]+|[a-z0-9-]+\.[a-z]{2,}[^\s]*)$/i);
  if (urlMatch) {
    let url = urlMatch[1];
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return {
      name: 'open_website',
      parameters: { url },
    };
  }

  // 14. Mouse scroll intent
  const scrollMatch = q.match(/^(?:mouse\s+)?scroll\s+(up|down)(?:\s+(\d+)\s*(?:times|clicks)?)?$/i);
  if (scrollMatch) {
    return {
      name: 'mouse_scroll',
      parameters: { direction: scrollMatch[1].toLowerCase(), clicks: scrollMatch[2] ? parseInt(scrollMatch[2], 10) : 3 },
    };
  }

  // 15. Mouse click at coordinates: "click at 500 300", "click 500, 300"
  const clickCoordMatch = q.match(/^(?:mouse\s+)?(?:left\s+)?click\s+(?:at\s+)?(\d+)\s*[,x ]\s*(\d+)$/i);
  if (clickCoordMatch) {
    return {
      name: 'mouse_click',
      parameters: { x: parseInt(clickCoordMatch[1], 10), y: parseInt(clickCoordMatch[2], 10), button: 'left' },
    };
  }

  // 16. Double click / Right click at coordinates
  const dblClickMatch = q.match(/^double\s*click(?:\s+at)?(?:\s+(\d+)\s*[,x ]\s*(\d+))?$/i);
  if (dblClickMatch) {
    return {
      name: 'mouse_click',
      parameters: {
        x: dblClickMatch[1] ? parseInt(dblClickMatch[1], 10) : 0,
        y: dblClickMatch[2] ? parseInt(dblClickMatch[2], 10) : 0,
        button: 'double',
      },
    };
  }

  const rgtClickMatch = q.match(/^right\s*click(?:\s+at)?(?:\s+(\d+)\s*[,x ]\s*(\d+))?$/i);
  if (rgtClickMatch) {
    return {
      name: 'mouse_click',
      parameters: {
        x: rgtClickMatch[1] ? parseInt(rgtClickMatch[1], 10) : 0,
        y: rgtClickMatch[2] ? parseInt(rgtClickMatch[2], 10) : 0,
        button: 'right',
      },
    };
  }

  // 17. Click on element described by text: "click on the search box", "click the first video", "click the submit button"
  const clickElementMatch = q.match(/^(?:mouse\s+)?click\s+(?:on\s+)?(?:the\s+)?(.+)$/i);
  if (clickElementMatch && !clickElementMatch[1].match(/^\d+$/)) {
    return {
      name: 'analyze_and_click',
      parameters: { element_description: clickElementMatch[1].trim() },
    };
  }

  // 18. Type text keyboard intent: "type hello world", "type in search box ..."
  const typeMatch = q.match(/^(?:keyboard\s+)?type\s+(.+)$/i);
  if (typeMatch && !calcMathMatch) {
    return {
      name: 'keyboard_type',
      parameters: { text: typeMatch[1].trim() },
    };
  }

  // 19. Press special key: "press enter", "hit escape", "press tab"
  const keyMatch = q.match(/^(?:press|hit)\s+(enter|escape|esc|tab|backspace|delete|space|up|down|left|right|f1|f2|f3|f4|f5|f11|f12)$/i);
  if (keyMatch) {
    return {
      name: 'keyboard_key',
      parameters: { key: keyMatch[1].toLowerCase() },
    };
  }

  // 20. Keyboard shortcut / hotkey: "press ctrl+c", "hit alt+tab", "shortcut ctrl+v"
  const hotkeyMatch = q.match(/^(?:press|hit|shortcut)\s+((?:ctrl|alt|shift|win)\s*\+\s*[a-z0-9]+)$/i);
  if (hotkeyMatch) {
    return {
      name: 'keyboard_hotkey',
      parameters: { combo: hotkeyMatch[1].replace(/\s+/g, '').toLowerCase() },
    };
  }

  return null;
}

export async function getAIResponse(
  userMessage: string,
  settings: AppSettings,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<AIResponse> {
  const apiKey = settings.ai.apiKeyGroq;

  // Clean trailing "over" conclusion keyword from spoken input
  const cleanMessage = userMessage.replace(/\b(?:over)\b[.!?]?\s*$/i, '').trim() || userMessage;

  // Check fallback intent first
  const directIntent = detectFallbackIntent(cleanMessage);

  // Specialized direct intent handling:
  // Immediately fulfill deterministic system actions without waiting for Groq LLM latency or hallucination
  if (
    directIntent &&
    (directIntent.name === 'calculate_in_app' ||
      directIntent.name === 'draw_in_paint' ||
      directIntent.name === 'youtube_search' ||
      directIntent.name === 'open_in_vscode' ||
      directIntent.name === 'list_live_apps' ||
      directIntent.name === 'control_live_app' ||
      directIntent.name === 'start_live_screen' ||
      directIntent.name === 'mouse_click' ||
      directIntent.name === 'mouse_scroll' ||
      directIntent.name === 'keyboard_type' ||
      directIntent.name === 'keyboard_key' ||
      directIntent.name === 'keyboard_hotkey' ||
      directIntent.name === 'analyze_and_click')
  ) {
    let responseText = 'Executing command.';
    if (directIntent.name === 'calculate_in_app') {
      responseText = `Opening Calculator and calculating ${directIntent.parameters.expression || ''}.`;
    } else if (directIntent.name === 'draw_in_paint') {
      responseText = `Opening Paint and drawing a ${directIntent.parameters.shape || 'face'} for you.`;
    } else if (directIntent.name === 'youtube_search') {
      responseText = `Going to YouTube and searching for "${directIntent.parameters.query || ''}".`;
    } else if (directIntent.name === 'open_in_vscode') {
      responseText = `Opening folder in Visual Studio Code and File Explorer.`;
    } else if (directIntent.name === 'list_live_apps') {
      responseText = `Checking all open applications on your screen.`;
    } else if (directIntent.name === 'control_live_app') {
      responseText = `${directIntent.parameters.action === 'close' ? 'Closing' : 'Switching to'} ${directIntent.parameters.app_name || 'application'}.`;
    } else if (directIntent.name === 'start_live_screen') {
      responseText = `Activating continuous live screen vision.`;
    } else if (directIntent.name === 'mouse_click') {
      responseText = `Clicking at ${directIntent.parameters.x}, ${directIntent.parameters.y}.`;
    } else if (directIntent.name === 'mouse_scroll') {
      responseText = `Scrolling ${directIntent.parameters.direction}.`;
    } else if (directIntent.name === 'keyboard_type') {
      responseText = `Typing "${directIntent.parameters.text}".`;
    } else if (directIntent.name === 'keyboard_key') {
      responseText = `Pressing ${directIntent.parameters.key}.`;
    } else if (directIntent.name === 'keyboard_hotkey') {
      responseText = `Pressing ${directIntent.parameters.combo}.`;
    } else if (directIntent.name === 'analyze_and_click') {
      responseText = `Finding and clicking ${directIntent.parameters.element_description}.`;
    }

    return {
      text: responseText,
      tool: directIntent,
    };
  }

  if (!apiKey) {
    if (directIntent) {
      return {
        text: `Executing command right away.`,
        tool: directIntent,
      };
    }
    return {
      text: 'No Groq API key is configured. Please add your Groq API key in Settings.',
      error: 'Missing Groq API Key',
    };
  }

  try {
    const recentTurns = chatHistory.slice(-8).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recentTurns,
      { role: 'user', content: cleanMessage },
    ];

    const modelName = settings.ai.model || 'openai/gpt-oss-20b';

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        tools: AVAILABLE_TOOLS,
        tool_choice: 'auto',
        temperature: settings.ai.temperature ?? 0.7,
        max_tokens: settings.ai.maxResponseLength || 1024,
      }),
    });

    if (!resp.ok) {
      if (directIntent) {
        return {
          text: `Executing tool right away.`,
          tool: directIntent,
        };
      }
      if (resp.status === 401) throw new Error('API key is invalid. Please check your Groq API key in Settings.');
      if (resp.status === 429) throw new Error('Rate limit exceeded. Please wait a few seconds and try again.');
      throw new Error(`AI service error (${resp.status}). Please try again.`);
    }

    const data = await resp.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const primaryCall = message.tool_calls[0];
      const fnName = primaryCall.function.name;
      let fnArgs: Record<string, any> = {};
      try {
        fnArgs = JSON.parse(primaryCall.function.arguments || '{}');
      } catch {
        fnArgs = {};
      }

      const tool: ToolCall = {
        name: fnName,
        parameters: fnArgs,
      };

      let spoken = cleanText(message.content || '');
      if (!spoken) {
        if (fnName === 'list_live_apps') spoken = 'Checking all open applications on your screen.';
        else if (fnName === 'control_live_app')
          spoken = `${fnArgs.action === 'close' ? 'Closing' : 'Switching to'} ${fnArgs.app_name || 'application'}.`;
        else if (fnName === 'calculate_in_app') spoken = `Opening Calculator and calculating ${fnArgs.expression || ''}.`;
        else if (fnName === 'youtube_search') spoken = `Going to YouTube and typing "${fnArgs.query || ''}".`;
        else if (fnName === 'open_in_vscode') spoken = `Opening folder in Visual Studio Code and File Explorer.`;
        else if (fnName === 'open_website') spoken = `Opening ${fnArgs.url || 'website'}.`;
        else if (fnName === 'web_search') spoken = `Searching for "${fnArgs.query || ''}".`;
        else if (fnName === 'open_application') spoken = `Launching ${fnArgs.app_name || 'application'}.`;
        else if (fnName === 'open_file') spoken = `Opening ${fnArgs.path || 'file'}.`;
        else if (fnName === 'write_and_open_file') spoken = `Typing text in ${fnArgs.filename || 'file'} and opening Notepad.`;
        else if (fnName === 'start_live_screen') spoken = `Activating continuous live screen vision.`;
        else if (fnName === 'capture_screen') spoken = `Scanning your screen right now...`;
        else if (fnName === 'mouse_click') spoken = `Clicking at ${fnArgs.x}, ${fnArgs.y}.`;
        else if (fnName === 'mouse_scroll') spoken = `Scrolling ${fnArgs.direction}.`;
        else if (fnName === 'keyboard_type') spoken = `Typing "${fnArgs.text}".`;
        else if (fnName === 'keyboard_key') spoken = `Pressing ${fnArgs.key}.`;
        else if (fnName === 'keyboard_hotkey') spoken = `Pressing ${fnArgs.combo}.`;
        else if (fnName === 'analyze_and_click') spoken = `Finding and clicking ${fnArgs.element_description}.`;
        else spoken = 'Executing command.';
      }

      return { text: spoken, tool };
    }

    const content = cleanText(message?.content || '');

    if (directIntent) {
      return {
        text: content || `Executing command right away.`,
        tool: directIntent,
      };
    }

    return {
      text: content || "I'm not sure how to respond to that.",
    };
  } catch (err: any) {
    console.error('AI service error:', err);
    if (directIntent) {
      return {
        text: `Executing command right away.`,
        tool: directIntent,
      };
    }
    return {
      text: err?.message || 'I had trouble connecting to the AI service. Please check your connection.',
      error: err?.message || String(err),
    };
  }
}
