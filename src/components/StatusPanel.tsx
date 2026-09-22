import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTeja } from '../store/TejaContext';
import { screenCapture } from '../services/screenCapture';

const statusConfig = {
  online: { color: 'bg-emerald-400', label: 'ONLINE' },
  ready: { color: 'bg-emerald-400', label: 'READY' },
  offline: { color: 'bg-red-500', label: 'OFFLINE' },
  denied: { color: 'bg-red-500', label: 'DENIED' },
  unavailable: { color: 'bg-red-500', label: 'UNAVAILABLE' },
  error: { color: 'bg-red-500', label: 'ERROR' },
  loading: { color: 'bg-yellow-400', label: 'LOADING' },
  disabled: { color: 'bg-gray-500', label: 'DISABLED' },
};

export function StatusPanel() {
  const { state, dispatch } = useTeja();
  const { status } = state;
  const [testing, setTesting] = useState<string | null>(null);

  const testMic = async () => {
    setTesting('mic');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      dispatch({ type: 'UPDATE_STATUS', payload: { microphone: 'ready' } });
    } catch {
      dispatch({ type: 'UPDATE_STATUS', payload: { microphone: 'denied' } });
    } finally {
      setTesting(null);
    }
  };

  const testVision = async () => {
    setTesting('vision');
    try {
      const res = await screenCapture.captureScreenFrame();
      if (res.imageBase64) {
        dispatch({ type: 'UPDATE_STATUS', payload: { vision: 'ready' } });
      } else {
        dispatch({ type: 'UPDATE_STATUS', payload: { vision: 'denied' } });
      }
    } catch {
      dispatch({ type: 'UPDATE_STATUS', payload: { vision: 'error' } });
    } finally {
      setTesting(null);
    }
  };

  const items = [
    { label: 'AI CORE', value: status.aiCore },
    { label: 'MICROPHONE', value: status.microphone, onTest: testMic },
    { label: 'VOICE (TTS)', value: status.voice },
    { label: 'VISION (SCREEN)', value: status.vision, onTest: testVision },
    { label: 'WAKE WORD', value: state.settings.voice.wakeWordEnabled ? 'ready' : 'disabled' },
    { label: 'MEMORY', value: status.memory },
  ];

  return (
    <motion.div
      className="glass rounded-xl p-5 w-80 shadow-2xl"
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <h3 className="text-cyan-400 font-semibold tracking-widest text-sm mb-4 uppercase flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        AI & Permissions Status
      </h3>
      <div className="space-y-3">
        {items.map(item => {
          const cfg = statusConfig[item.value as keyof typeof statusConfig] || statusConfig.ready;
          return (
            <div key={item.label} className="flex items-center justify-between text-xs">
              <span className="text-gray-400 tracking-wider font-mono">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className={`status-dot w-2 h-2 rounded-full ${cfg.color}`} />
                <span className="text-gray-300 font-mono">{cfg.label}</span>
                {item.onTest && (
                  <button
                    onClick={item.onTest}
                    disabled={testing !== null}
                    className="text-[9px] font-mono px-1.5 py-0.5 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 rounded border border-cyan-500/30 transition-all ml-1"
                  >
                    {testing === (item.label.includes('MIC') ? 'mic' : 'vision') ? '...' : 'TEST'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-cyan-500/10 space-y-1">
        <div className="text-[10px] text-gray-400 tracking-wider font-mono">
          BUILD: TEJA AI v1.1.0
        </div>
        <div className="text-[10px] text-gray-400 tracking-wider font-mono">
          PROVIDER: {state.settings.ai.provider.toUpperCase()}
        </div>
        <div className="text-[10px] text-gray-400 tracking-wider font-mono truncate" title={state.settings.ai.model}>
          MODEL: {state.settings.ai.model}
        </div>
        <div className="text-[10px] text-emerald-400 tracking-wider font-mono mt-2">
          ● LOCALSTORAGE SYNC: ENABLED
        </div>
      </div>
    </motion.div>
  );
}
