/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AssistantState, AppSettings, HistoryEntry, SystemStatus } from '../types';

export interface TejaState {
  state: AssistantState;
  transcript: string;
  response: string;
  errorMessage: string;
  settings: AppSettings;
  history: HistoryEntry[];
  status: SystemStatus;
  activePanel: 'none' | 'status' | 'history' | 'system' | 'settings' | 'chat';
  voiceLevel: number;
  isChatMode: boolean;
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string; time: string }>;
  pendingUrl: { label: string; url: string } | null;
  isLiveScreenActive: boolean;
  // Live Session
  isLiveSession: boolean;
  sessionStartTime: number | null;
  currentAction: string;
  isMuted: boolean;
}

export type TejaAction =
  | { type: 'SET_STATE'; payload: AssistantState }
  | { type: 'SET_TRANSCRIPT'; payload: string }
  | { type: 'APPEND_TRANSCRIPT'; payload: string }
  | { type: 'SET_RESPONSE'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_VOICE_LEVEL'; payload: number }
  | { type: 'ADD_HISTORY'; payload: HistoryEntry }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_PANEL'; payload: TejaState['activePanel'] }
  | { type: 'UPDATE_STATUS'; payload: Partial<SystemStatus> }
  | { type: 'SET_CHAT_MODE'; payload: boolean }
  | { type: 'ADD_CHAT_MESSAGE'; payload: { role: 'user' | 'assistant'; content: string } }
  | { type: 'SET_PENDING_URL'; payload: { label: string; url: string } | null }
  | { type: 'SET_LIVE_SCREEN_ACTIVE'; payload: boolean }
  | { type: 'CLEAR_CHAT' }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'RESET_CONVERSATION' }
  // Live Session actions
  | { type: 'START_LIVE_SESSION' }
  | { type: 'END_LIVE_SESSION' }
  | { type: 'SET_CURRENT_ACTION'; payload: string }
  | { type: 'SET_MUTED'; payload: boolean };

const STORAGE_KEY_SETTINGS = 'teja_ai_settings_v1';
const STORAGE_KEY_HISTORY = 'teja_ai_history_v1';
const STORAGE_KEY_MESSAGES = 'teja_ai_messages_v1';

const defaultSettings: AppSettings = {
  ai: {
    provider: 'cloud',
    model: 'openai/gpt-oss-20b',
    temperature: 0.7,
    maxResponseLength: 1024,
    apiKeyGroq: (import.meta as any).env?.VITE_GROQ_API_KEY || '',
    apiKeyOpenRouter: (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '',
  },
  voice: {
    wakeWordEnabled: true,
    ttsVoice: 'default',
    speechSpeed: 1,
    volume: 0.8,
    microphoneDevice: 'default',
    speakerDevice: 'default',
  },
  appearance: {
    theme: 'dark',
    accentColor: '#00f0ff',
    animationIntensity: 1,
    transparency: 0.85,
  },
  privacy: {
    microphoneEnabled: true,
    screenCaptureEnabled: true,
    cloudAIEnabled: true,
    memoryEnabled: true,
    webSearchEnabled: true,
  },
  applications: [
    { id: 'calculator', name: 'Calculator', path: 'calc' },
    { id: 'explorer', name: 'File Manager', path: 'explorer' },
    { id: 'notepad', name: 'Notepad', path: 'notepad' },
    { id: 'chrome', name: 'Chrome', path: 'chrome' },
    { id: 'cmd', name: 'Terminal', path: 'cmd' },
    { id: 'paint', name: 'Paint', path: 'mspaint' },
    { id: 'taskmgr', name: 'Task Manager', path: 'taskmgr' },
    { id: 'vscode', name: 'VS Code', path: 'code' },
    { id: 'spotify', name: 'Spotify', path: 'spotify' },
    { id: 'discord', name: 'Discord', path: 'discord' },
  ],
};

function loadPersistedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultSettings,
        ...parsed,
        ai: {
          ...defaultSettings.ai,
          ...parsed.ai,
          // If stored key is empty but env has a key, use env key
          apiKeyGroq: parsed.ai?.apiKeyGroq || defaultSettings.ai.apiKeyGroq,
          apiKeyOpenRouter: parsed.ai?.apiKeyOpenRouter || defaultSettings.ai.apiKeyOpenRouter,
        },
        privacy: {
          ...defaultSettings.privacy,
          ...parsed.privacy,
        },
        voice: {
          ...defaultSettings.voice,
          ...parsed.voice,
        }
      };
    }
  } catch (e) {
    console.warn('Failed to load settings from storage', e);
  }
  return defaultSettings;
}

function loadPersistedHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function loadPersistedMessages(): Array<{ role: 'user' | 'assistant'; content: string; time: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

const initialState: TejaState = {
  state: 'idle',
  transcript: '',
  response: '',
  errorMessage: '',
  settings: loadPersistedSettings(),
  history: loadPersistedHistory(),
  status: {
    aiCore: 'online',
    microphone: 'ready',
    voice: 'loading',
    vision: 'ready',
    web: 'ready',
    memory: 'ready',
  },
  activePanel: 'none',
  voiceLevel: 0,
  isChatMode: false,
  chatMessages: loadPersistedMessages(),
  pendingUrl: null,
  isLiveScreenActive: false,
  // Live Session
  isLiveSession: false,
  sessionStartTime: null,
  currentAction: '',
  isMuted: false,
};

function tejaReducer(state: TejaState, action: TejaAction): TejaState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, state: action.payload, errorMessage: action.payload === 'error' ? state.errorMessage : '' };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload };
    case 'APPEND_TRANSCRIPT':
      return { ...state, transcript: state.transcript + action.payload };
    case 'SET_RESPONSE':
      return { ...state, response: action.payload };
    case 'SET_ERROR':
      return { ...state, state: 'error', errorMessage: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, state: 'idle', errorMessage: '' };
    case 'SET_VOICE_LEVEL':
      return { ...state, voiceLevel: action.payload };
    case 'ADD_HISTORY': {
      const newHistory = [action.payload, ...state.history].slice(0, 50);
      try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory)); } catch {}
      return { ...state, history: newHistory };
    }
    case 'CLEAR_HISTORY': {
      try { localStorage.removeItem(STORAGE_KEY_HISTORY); } catch {}
      return { ...state, history: [] };
    }
    case 'UPDATE_SETTINGS': {
      const newSettings = { ...state.settings, ...action.payload };
      try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings)); } catch {}
      return { ...state, settings: newSettings };
    }
    case 'SET_PANEL':
      return { ...state, activePanel: state.activePanel === action.payload ? 'none' : action.payload };
    case 'UPDATE_STATUS':
      return { ...state, status: { ...state.status, ...action.payload } };
    case 'SET_CHAT_MODE':
      return { ...state, isChatMode: action.payload };
    case 'ADD_CHAT_MESSAGE': {
      const newMessages = [
        ...state.chatMessages,
        { ...action.payload, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ];
      try { localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(newMessages.slice(-100))); } catch {}
      return { ...state, chatMessages: newMessages };
    }
    case 'CLEAR_CHAT': {
      try { localStorage.removeItem(STORAGE_KEY_MESSAGES); } catch {}
      return { ...state, chatMessages: [] };
    }
    case 'SET_PENDING_URL':
      return { ...state, pendingUrl: action.payload };
    case 'SET_LIVE_SCREEN_ACTIVE':
      return { ...state, isLiveScreenActive: action.payload };
    // Live Session
    case 'START_LIVE_SESSION':
      return { ...state, isLiveSession: true, sessionStartTime: Date.now(), currentAction: '' };
    case 'END_LIVE_SESSION':
      return { ...state, isLiveSession: false, sessionStartTime: null, currentAction: '', state: 'idle' };
    case 'SET_CURRENT_ACTION':
      return { ...state, currentAction: action.payload };
    case 'SET_MUTED':
      return { ...state, isMuted: action.payload };
    case 'RESET_CONVERSATION':
      // Do NOT erase response or transcript so user can comfortably read what was spoken!
      return state;
    default:
      return state;
  }
}

interface TejaContextType {
  state: TejaState;
  dispatch: React.Dispatch<TejaAction>;
}

const TejaContext = createContext<TejaContextType | null>(null);

export function TejaProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tejaReducer, initialState);
  return (
    <TejaContext.Provider value={{ state, dispatch }}>
      {children}
    </TejaContext.Provider>
  );
}

export function useTeja() {
  const context = useContext(TejaContext);
  if (!context) throw new Error('useTeja must be used within TejaProvider');
  return context;
}
