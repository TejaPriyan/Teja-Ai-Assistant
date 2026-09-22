import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTeja } from '../store/TejaContext';
import { textToSpeech } from '../services/textToSpeech';
import type { AIProvider } from '../types';

export function SettingsPanel() {
  const { state, dispatch } = useTeja();
  const { settings } = state;
  const [section, setSection] = useState<'ai' | 'voice' | 'appearance' | 'privacy'>('ai');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = textToSpeech.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };
    loadVoices();
    // Voices load asynchronously in some browsers
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    // Also retry after a short delay
    const timer = setTimeout(loadVoices, 500);
    return () => clearTimeout(timer);
  }, []);

  const updateAI = (patch: Partial<typeof settings.ai>) =>
    dispatch({ type: 'UPDATE_SETTINGS', payload: { ai: { ...settings.ai, ...patch } } });

  const updateVoice = (patch: Partial<typeof settings.voice>) =>
    dispatch({ type: 'UPDATE_SETTINGS', payload: { voice: { ...settings.voice, ...patch } } });

  const updateAppearance = (patch: Partial<typeof settings.appearance>) =>
    dispatch({ type: 'UPDATE_SETTINGS', payload: { appearance: { ...settings.appearance, ...patch } } });

  const updatePrivacy = (patch: Partial<typeof settings.privacy>) =>
    dispatch({ type: 'UPDATE_SETTINGS', payload: { privacy: { ...settings.privacy, ...patch } } });

  const handleVoiceChange = (voiceName: string) => {
    updateVoice({ ttsVoice: voiceName });
    textToSpeech.setVoiceByName(voiceName);
  };

  const testVoice = async () => {
    if (isTesting) return;
    setIsTesting(true);
    try {
      textToSpeech.setRate(settings.voice.speechSpeed);
      textToSpeech.setVolume(settings.voice.volume);
      await textToSpeech.speak('Hello! I am Teja, your personal AI assistant. How can I help you today?');
    } catch {
      // ignore
    } finally {
      setIsTesting(false);
    }
  };

  const stopTest = () => {
    textToSpeech.stop();
    setIsTesting(false);
  };

  // Group voices by language for better UX
  const groupedVoices = availableVoices.reduce<Record<string, SpeechSynthesisVoice[]>>((acc, voice) => {
    const lang = voice.lang.split('-')[0].toUpperCase();
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(voice);
    return acc;
  }, {});

  const currentVoiceName = settings.voice.ttsVoice || textToSpeech.getCurrentVoiceName();

  return (
    <motion.div
      className="glass rounded-xl w-[520px] max-h-[75vh] flex flex-col"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <h3 className="text-cyan-400 font-semibold tracking-widest text-sm p-4 border-b border-cyan-500/10 uppercase flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        Settings
      </h3>

      <div className="flex border-b border-cyan-500/10">
        {(['ai', 'voice', 'appearance', 'privacy'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`flex-1 py-3 text-xs uppercase tracking-widest font-mono transition-all ${
              section === s
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {section === 'ai' && (
          <>
            <SectionHeader title="AI Provider" />
            <div className="grid grid-cols-3 gap-2">
              {(['local', 'cloud', 'automatic'] as AIProvider[]).map(p => (
                <button
                  key={p}
                  onClick={() => updateAI({ provider: p })}
                  className={`py-2.5 px-3 rounded-lg text-xs font-mono uppercase tracking-wider border transition-all ${
                    settings.ai.provider === p
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <SectionHeader title="Model" />
            <select
              value={settings.ai.model}
              onChange={e => updateAI({ model: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
            >
              <option value="openai/gpt-oss-20b" className="bg-gray-900">GPT-OSS 20B (Recommended — Fast &amp; Reliable)</option>
              <option value="openai/gpt-oss-120b" className="bg-gray-900">GPT-OSS 120B (Most capable)</option>
              <option value="qwen/qwen3.8-27b" className="bg-gray-900">Qwen 3.8 27B</option>
              <option value="groq/compound-mini" className="bg-gray-900">Groq Compound Mini (Very Fast)</option>
              <option value="groq/compound" className="bg-gray-900">Groq Compound (Smart routing - may be verbose)</option>
            </select>

            <SettingSlider
              label="Temperature"
              value={settings.ai.temperature}
              min={0} max={1} step={0.1}
              onChange={v => updateAI({ temperature: v })}
            />
            <SettingSlider
              label="Max Response Length"
              value={settings.ai.maxResponseLength}
              min={256} max={4096} step={256}
              onChange={v => updateAI({ maxResponseLength: v })}
            />

            <SectionHeader title="API Keys" />
            <div className="text-[10px] text-gray-500 mb-2">Stored locally in app configuration</div>
            <PasswordField
              label="Groq API Key"
              value={settings.ai.apiKeyGroq || ''}
              onChange={v => updateAI({ apiKeyGroq: v })}
              placeholder="gsk_..."
            />
            <div className="mt-3">
              <PasswordField
                label="OpenRouter API Key (Powers Screen Vision Analysis)"
                value={settings.ai.apiKeyOpenRouter || ''}
                onChange={v => updateAI({ apiKeyOpenRouter: v })}
                placeholder="sk-or-v1-..."
              />
            </div>
          </>
        )}

        {section === 'voice' && (
          <>
            <ToggleRow
              label="Wake Word (Hey Teja)"
              enabled={settings.voice.wakeWordEnabled}
              onChange={v => updateVoice({ wakeWordEnabled: v })}
            />

            <SectionHeader title="Voice Selection" />
            <div className="space-y-2">
              <select
                value={currentVoiceName}
                onChange={e => handleVoiceChange(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50 transition-all"
              >
                <option value="default" className="bg-gray-900">🔊 System Default</option>
                {Object.entries(groupedVoices).map(([lang, voices]) => (
                  <optgroup key={lang} label={`── ${lang} ──`}>
                    {voices.map(v => (
                      <option key={v.name} value={v.name} className="bg-gray-900">
                        {v.name} {v.localService ? '(Local)' : '(Network)'} — {v.lang}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={isTesting ? stopTest : testVoice}
                  className={`flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border transition-all ${
                    isTesting
                      ? 'bg-red-500/20 border-red-400 text-red-300 hover:bg-red-500/30'
                      : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
                  }`}
                >
                  {isTesting ? '■ Stop Test' : '▶ Test Voice'}
                </button>
              </div>

              {currentVoiceName !== 'default' && (
                <div className="text-[10px] text-cyan-400/60 font-mono mt-1">
                  Active: {currentVoiceName}
                </div>
              )}
            </div>

            <SettingSlider
              label="Speech Speed"
              value={settings.voice.speechSpeed}
              min={0.5} max={2} step={0.1}
              onChange={v => updateVoice({ speechSpeed: v })}
            />
            <SettingSlider
              label="Volume"
              value={settings.voice.volume}
              min={0} max={1} step={0.05}
              onChange={v => updateVoice({ volume: v })}
            />
            <div className="text-xs text-gray-500 mt-2 bg-white/5 rounded-lg p-3">
              💡 Uses browser/system TTS and STT for V1. Piper and Whisper will be integrated in later versions for fully offline voice.
            </div>
          </>
        )}

        {section === 'appearance' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateAppearance({ theme: 'dark' })}
                className={`py-3 rounded-lg text-xs font-mono uppercase border transition-all ${
                  settings.appearance.theme === 'dark'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => updateAppearance({ theme: 'light' })}
                className={`py-3 rounded-lg text-xs font-mono uppercase border transition-all ${
                  settings.appearance.theme === 'light'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                Light
              </button>
            </div>
            <SettingSlider
              label="Animation Intensity"
              value={settings.appearance.animationIntensity}
              min={0} max={1} step={0.1}
              onChange={v => updateAppearance({ animationIntensity: v })}
            />
            <SettingSlider
              label="Transparency"
              value={settings.appearance.transparency}
              min={0.3} max={1} step={0.05}
              onChange={v => updateAppearance({ transparency: v })}
            />
          </>
        )}

        {section === 'privacy' && (
          <>
            <ToggleRow label="Microphone" enabled={settings.privacy.microphoneEnabled} onChange={v => updatePrivacy({ microphoneEnabled: v })} />
            <ToggleRow label="Screen Capture" enabled={settings.privacy.screenCaptureEnabled} onChange={v => updatePrivacy({ screenCaptureEnabled: v })} />
            <ToggleRow label="Cloud AI" enabled={settings.privacy.cloudAIEnabled} onChange={v => updatePrivacy({ cloudAIEnabled: v })} />
            <ToggleRow label="Web Search" enabled={settings.privacy.webSearchEnabled} onChange={v => updatePrivacy({ webSearchEnabled: v })} />
            <ToggleRow label="Local Memory" enabled={settings.privacy.memoryEnabled} onChange={v => updatePrivacy({ memoryEnabled: v })} />

            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
              🔒 Privacy: Wake word detection runs locally. Speech recognition in V1 uses your browser's built-in STT. No audio is sent to third parties except to the AI provider you configure.
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <div className="text-xs text-cyan-400/70 font-mono tracking-widest uppercase mt-4 mb-2 first:mt-0">{title}</div>;
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`w-11 h-6 rounded-full transition-all relative ${enabled ? 'bg-cyan-500' : 'bg-white/10'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function SettingSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-gray-400">{label}</span>
        <span className="text-cyan-300 font-mono">{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-16 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 font-mono"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300 px-2"
        >
          {show ? 'HIDE' : 'SHOW'}
        </button>
      </div>
    </div>
  );
}
