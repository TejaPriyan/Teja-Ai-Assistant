export type AssistantState = 'idle' | 'listening' | 'thinking' | 'acting' | 'speaking' | 'error';

export type AIProvider = 'local' | 'cloud' | 'automatic';

export interface AppSettings {
  ai: {
    provider: AIProvider;
    model: string;
    temperature: number;
    maxResponseLength: number;
    apiKeyGroq?: string;
    apiKeyOpenRouter?: string;
  };
  voice: {
    wakeWordEnabled: boolean;
    ttsVoice: string;
    speechSpeed: number;
    volume: number;
    microphoneDevice: string;
    speakerDevice: string;
  };
  appearance: {
    theme: 'dark' | 'light';
    accentColor: string;
    animationIntensity: number;
    transparency: number;
  };
  privacy: {
    microphoneEnabled: boolean;
    screenCaptureEnabled: boolean;
    cloudAIEnabled: boolean;
    memoryEnabled: boolean;
    webSearchEnabled: boolean;
  };
  applications: RegisteredApplication[];
}

export interface RegisteredApplication {
  id: string;
  name: string;
  path: string;
  icon?: string;
}

export interface RegisteredWebsite {
  id: string;
  name: string;
  url: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  userQuery: string;
  aiResponse: string;
  toolUsed?: string;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  timestamp: number;
}

export interface SystemStatus {
  aiCore: 'online' | 'offline' | 'error';
  microphone: 'ready' | 'denied' | 'unavailable';
  voice: 'ready' | 'error' | 'loading';
  vision: 'ready' | 'error' | 'disabled' | 'denied';
  web: 'ready' | 'error' | 'disabled';
  memory: 'ready' | 'error' | 'disabled';
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

export interface AIResponse {
  text: string;
  tool?: ToolCall;
  error?: string;
}

export interface VoiceActivityLevel {
  level: number;
  timestamp: number;
}

/** A single step in an action plan for computer control */
export interface ActionStep {
  id: number;
  action: string; // e.g. 'mouse_click', 'keyboard_type', 'open_application'
  description: string; // human-readable: "Click the search box"
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: string;
}

/** Safety level for actions */
export type ActionSafety = 'safe' | 'confirm_required' | 'blocked';
