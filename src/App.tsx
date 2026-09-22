import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TejaProvider, useTeja } from './store/TejaContext';
import { useAssistant } from './hooks/useAssistant';
import { AIOrb } from './components/AIOrb';
import { StatusPanel } from './components/StatusPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SystemPanel } from './components/SystemPanel';
import { ChatPanel } from './components/ChatPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { LiveScreenMonitor } from './components/LiveScreenMonitor';

/** Format session duration as MM:SS */
function formatDuration(startTime: number | null): string {
  if (!startTime) return '00:00';
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function AppContent() {
  const { state, dispatch } = useTeja();
  const {
    startListening,
    stopSpeaking,
    sendTextMessage,
    stopListening,
    triggerScreenCapture,
    startLiveVision,
    stopLiveVision,
    startLiveSession,
    endLiveSession,
    toggleMute,
  } = useAssistant();

  // Session timer
  const [sessionTimer, setSessionTimer] = useState('00:00');
  useEffect(() => {
    if (!state.isLiveSession || !state.sessionStartTime) return;
    setSessionTimer(formatDuration(state.sessionStartTime));
    const interval = setInterval(() => {
      setSessionTimer(formatDuration(state.sessionStartTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isLiveSession, state.sessionStartTime]);

  const stateText: Record<string, string> = {
    idle: state.isLiveSession
      ? 'READY'
      : state.settings.voice.wakeWordEnabled
        ? 'SAY "HEY TEJA" OR CLICK'
        : 'CLICK ORB TO TALK',
    listening: 'LISTENING...',
    thinking: 'THINKING...',
    acting: state.currentAction || 'ACTING...',
    speaking: 'SPEAKING...',
    error: 'ATTENTION NEEDED',
  };

  const handleOrbClick = () => {
    if (state.state === 'idle' || state.state === 'error') {
      if (!state.isLiveSession) {
        startLiveSession();
      } else {
        startListening();
      }
    } else if (state.state === 'speaking') {
      stopSpeaking();
    } else if (state.state === 'listening') {
      stopListening();
    }
  };

  const closePanel = () => dispatch({ type: 'SET_PANEL', payload: 'none' });
  const showBottomBar = state.activePanel !== 'chat' && state.activePanel !== 'settings';

  return (
    <div className="relative w-full h-full overflow-hidden grid-bg">
      {/* Radial background glow */}
      <div className="absolute inset-0 radial-glow pointer-events-none" />

      {/* Scanlines overlay */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      {/* Corner decorations (sci-fi HUD) */}
      <CornerDecorations />

      {/* Live Screen Picture-in-Picture Monitor */}
      <AnimatePresence>
        {state.isLiveScreenActive && (
          <LiveScreenMonitor
            onAnalyze={(prompt) => triggerScreenCapture(prompt)}
            onClose={stopLiveVision}
          />
        )}
      </AnimatePresence>

      {/* Pending Link Banner (Popup blocker fallback) */}
      <AnimatePresence>
        {state.pendingUrl && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-cyan-950/90 border border-cyan-400/80 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md"
          >
            <span className="text-xs text-cyan-200 font-mono">{state.pendingUrl.label}</span>
            <a
              href={state.pendingUrl.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => dispatch({ type: 'SET_PENDING_URL', payload: null })}
              className="text-xs font-mono uppercase bg-cyan-400 text-black font-semibold px-3 py-1 rounded-md hover:bg-cyan-300 transition-colors"
            >
              Open Tab ↗
            </a>
            <button
              onClick={() => dispatch({ type: 'SET_PENDING_URL', payload: null })}
              className="text-xs text-gray-400 hover:text-white px-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-6 py-4 z-20">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-3"
        >
          <div className={`w-2 h-2 rounded-full shadow-lg ${
            state.isLiveSession ? 'bg-red-500 shadow-red-500/50 status-dot' : 'bg-cyan-400 shadow-cyan-400/50 status-dot'
          }`} />
          <span className="text-sm font-mono tracking-[0.3em] text-cyan-400/90 uppercase">Teja AI</span>
          {state.isLiveSession && (
            <span className="text-[10px] font-mono text-red-400/80 tracking-widest ml-1 flex items-center gap-1.5">
              <span className="relative inline-block w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-red-500" />
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping" />
              </span>
              LIVE · {sessionTimer}
            </span>
          )}
          {!state.isLiveSession && (
            <span className="text-[10px] font-mono text-cyan-400/40 tracking-widest ml-2 hidden sm:inline">v2.0</span>
          )}
        </motion.div>

        <div className="flex items-center gap-2">
          <IconButton
            label={state.isLiveScreenActive ? 'Stop Live Screen' : 'Start Continuous Live Screen Vision'}
            active={state.isLiveScreenActive}
            onClick={() => {
              if (state.isLiveScreenActive) stopLiveVision();
              else startLiveVision();
            }}
            icon={<LiveScreenIcon active={state.isLiveScreenActive} />}
          />
          <IconButton
            label="See Screen Once"
            active={false}
            onClick={() => triggerScreenCapture()}
            icon={<EyeIcon />}
          />
          <IconButton
            label="AI Status"
            active={state.activePanel === 'status'}
            onClick={() => dispatch({ type: 'SET_PANEL', payload: 'status' })}
            icon={<DotIcon />}
          />
          <IconButton
            label="Command History"
            active={state.activePanel === 'history'}
            onClick={() => dispatch({ type: 'SET_PANEL', payload: 'history' })}
            icon={<ClockIcon />}
          />
          <IconButton
            label="System Info"
            active={state.activePanel === 'system'}
            onClick={() => dispatch({ type: 'SET_PANEL', payload: 'system' })}
            icon={<ChipIcon />}
          />
          <IconButton
            label="Chat"
            active={state.activePanel === 'chat'}
            onClick={() => dispatch({ type: 'SET_PANEL', payload: 'chat' })}
            icon={<ChatIcon />}
          />
          <IconButton
            label="Settings"
            active={state.activePanel === 'settings'}
            onClick={() => dispatch({ type: 'SET_PANEL', payload: 'settings' })}
            icon={<GearIcon />}
          />
        </div>
      </div>

      {/* Left Panel (Status) */}
      <AnimatePresence>
        {state.activePanel === 'status' && (
          <div className="absolute left-6 top-20 z-20">
            <StatusPanel />
          </div>
        )}
      </AnimatePresence>

      {/* Right Panels */}
      <AnimatePresence>
        {(state.activePanel === 'history' || state.activePanel === 'system') && (
          <div className="absolute right-6 top-20 z-20">
            {state.activePanel === 'history' ? <HistoryPanel /> : <SystemPanel />}
          </div>
        )}
      </AnimatePresence>

      {/* Center - Main orb area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        <motion.div
          onClick={handleOrbClick}
          className="cursor-pointer select-none"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 1 }}
          title={state.state === 'idle' ? 'Click to start session' : state.state === 'speaking' ? 'Click to interrupt' : ''}
        >
          <AIOrb />
        </motion.div>

        {/* State text */}
        <motion.div
          key={`${state.state}-${state.isLiveSession}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="mt-2 text-center"
        >
          <div className="text-xl font-mono tracking-[0.4em] text-cyan-100 neon-text uppercase">
            {state.state === 'idle' && !state.isLiveSession ? 'TEJA AI' : stateText[state.state]}
          </div>

          {/* Action status during acting */}
          <AnimatePresence>
            {state.state === 'acting' && state.currentAction && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2 flex items-center justify-center gap-2 text-xs font-mono tracking-widest text-emerald-400"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{state.currentAction.toUpperCase()}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {state.state === 'listening' && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs font-mono tracking-widest text-cyan-400">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>{state.isLiveSession ? 'SPEAK NATURALLY · SAY "OVER" TO END' : 'SAY "OVER" OR PAUSE TO EXECUTE'}</span>
            </div>
          )}
          {state.state === 'idle' && !state.isLiveSession && (
            <div className="mt-2 text-xs font-mono tracking-[0.3em] text-cyan-400/70">
              {state.settings.voice.wakeWordEnabled ? 'SAY "HEY TEJA" TO START SESSION' : 'ONLINE · READY'}
            </div>
          )}
          {state.state === 'idle' && state.isLiveSession && (
            <div className="mt-2 text-xs font-mono tracking-[0.3em] text-cyan-400/70">
              LIVE SESSION · WAITING FOR COMMAND
            </div>
          )}
        </motion.div>

        {/* Transcript display */}
        <AnimatePresence mode="wait">
          {state.transcript && (state.state === 'listening' || state.state === 'thinking' || state.state === 'acting') && (
            <motion.div
              key="transcript"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-5 max-w-2xl text-center"
            >
              <div className="text-lg text-white/90 italic font-mono">"{state.transcript}"</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Response display */}
        <AnimatePresence mode="wait">
          {state.response && (
            <motion.div
              key="response"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 max-w-2xl text-center bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm"
            >
              <div className="text-sm sm:text-base text-cyan-200 leading-relaxed font-sans">{state.response}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error display */}
        <AnimatePresence>
          {state.state === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4"
            >
              <div className="text-red-400 text-sm text-center max-w-md bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                {state.errorMessage}
              </div>
              <div className="flex items-center justify-center gap-3 mt-3">
                <button
                  onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
                  className="text-xs text-gray-400 hover:text-white font-mono tracking-widest uppercase"
                >
                  [Dismiss]
                </button>
                <button
                  onClick={startListening}
                  className="text-xs text-cyan-400 hover:text-cyan-200 font-mono tracking-widest uppercase"
                >
                  [Try Again]
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom center: controls */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center items-end pb-8 z-10 pointer-events-none">
        <AnimatePresence mode="wait">
          {state.activePanel === 'chat' ? (
            <motion.div
              key="chat"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="pointer-events-auto"
            >
              <ChatPanel onSend={sendTextMessage} />
              <PanelCloseButton onClick={closePanel} />
            </motion.div>
          ) : state.activePanel === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              className="pointer-events-auto"
            >
              <SettingsPanel />
              <PanelCloseButton onClick={closePanel} />
            </motion.div>
          ) : showBottomBar ? (
            <motion.div
              key="mic"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="pointer-events-auto flex items-center gap-4"
            >
              <div className="glass rounded-full px-5 py-3 flex items-center gap-4 shadow-xl">
                {/* Main mic / session button */}
                <button
                  onClick={() => {
                    if (!state.isLiveSession) {
                      startLiveSession();
                    } else {
                      startListening();
                    }
                  }}
                  disabled={state.state === 'listening' || state.state === 'thinking' || state.state === 'acting'}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md ${
                    state.isLiveSession
                      ? 'bg-red-500/20 border-red-400/50 shadow-red-500/20'
                      : 'bg-cyan-500/20 border-cyan-400/50 shadow-cyan-500/20 hover:bg-cyan-500/40'
                  }`}
                  title={state.isLiveSession ? 'Speak (Ctrl+Space)' : 'Start session (Ctrl+Space)'}
                >
                  <MicIcon />
                </button>

                {/* Status text */}
                <div className="text-xs font-mono text-gray-300 tracking-wider min-w-[140px] text-center">
                  {state.isLiveSession
                    ? state.state === 'idle'
                      ? 'Say something...'
                      : state.state === 'listening'
                      ? 'Listening...'
                      : state.state === 'thinking'
                      ? 'Thinking...'
                      : state.state === 'acting'
                      ? state.currentAction || 'Acting...'
                      : state.state === 'speaking'
                      ? 'Speaking...'
                      : ''
                    : state.settings.voice.wakeWordEnabled
                      ? 'Say "Hey Teja"'
                      : 'Ctrl+Space to talk'
                  }
                </div>

                {/* Mute button (live session only) */}
                {state.isLiveSession && (
                  <button
                    onClick={toggleMute}
                    className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                      state.isMuted
                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                        : 'bg-white/5 border-white/15 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                    }`}
                    title={state.isMuted ? 'Unmute' : 'Mute'}
                  >
                    {state.isMuted ? <MicMuteIcon /> : <MicIcon />}
                  </button>
                )}

                {/* Screen buttons */}
                <button
                  onClick={() => triggerScreenCapture()}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/15 flex items-center justify-center hover:bg-cyan-500/20 text-cyan-300 transition-all"
                  title="See Screen (Snapshot)"
                >
                  <EyeIcon />
                </button>

                {/* End session button (live session only) */}
                {state.isLiveSession ? (
                  <button
                    onClick={endLiveSession}
                    className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center hover:bg-red-500/40 transition-all text-red-300"
                    title="End session (Escape)"
                  >
                    <PhoneEndIcon />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (state.isLiveScreenActive) stopLiveVision();
                      else startLiveVision();
                    }}
                    className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                      state.isLiveScreenActive
                        ? 'bg-red-500/20 border-red-500/60 text-red-300 shadow-md shadow-red-500/20'
                        : 'bg-white/5 border-white/15 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                    }`}
                    title={state.isLiveScreenActive ? 'Stop Live Screen' : 'Continuous Live Screen Vision'}
                  >
                    <LiveScreenIcon active={state.isLiveScreenActive} />
                  </button>
                )}

                {/* Stop speaking */}
                <button
                  onClick={stopSpeaking}
                  disabled={state.state !== 'speaking'}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Stop speaking"
                >
                  <StopIcon />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Privacy indicators */}
      <div className="absolute bottom-4 left-4 flex gap-2 z-10">
        {state.isLiveSession && <PrivacyDot label="LIVE SESSION" color="bg-red-500" pulse />}
        {state.settings.privacy.microphoneEnabled && (
          <PrivacyDot
            label="MIC"
            color={state.state === 'listening' ? 'bg-red-500' : 'bg-emerald-400'}
            pulse={state.state === 'listening'}
          />
        )}
        {state.state === 'speaking' && <PrivacyDot label="SPEAKER" color="bg-cyan-400" pulse />}
        {state.state === 'acting' && <PrivacyDot label="CONTROLLING" color="bg-emerald-400" pulse />}
        {state.settings.voice.wakeWordEnabled && !state.isLiveSession && <PrivacyDot label="WAKE WORD" color="bg-cyan-400" />}
        {state.isLiveScreenActive && <PrivacyDot label="LIVE SCREEN" color="bg-red-500" pulse />}
        {state.settings.privacy.cloudAIEnabled && (state.state === 'thinking' || state.state === 'speaking') && (
          <PrivacyDot label="CLOUD AI" color="bg-purple-400" pulse />
        )}
      </div>

      {/* Help hint */}
      {state.state === 'idle' && !state.response && state.activePanel === 'none' && !state.isLiveSession && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-gray-500 tracking-widest text-center pointer-events-none">
          Say "Hey Teja" to start a live session · Click orb · Ctrl+Space
        </div>
      )}

      {/* Version */}
      <div className="absolute bottom-4 right-4 text-[10px] font-mono text-gray-500 tracking-widest z-10">
        TEJA AI · v2.0.0
      </div>
    </div>
  );
}

function PanelCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center mt-2">
      <button
        onClick={onClick}
        className="text-[10px] font-mono tracking-widest text-gray-400 hover:text-cyan-300 uppercase transition-colors"
      >
        [Close ×]
      </button>
    </div>
  );
}

function CornerDecorations() {
  return (
    <>
      <svg className="absolute top-2 left-2 w-16 h-16 opacity-40 pointer-events-none" viewBox="0 0 100 100">
        <path d="M0 30 L0 0 L30 0" fill="none" stroke="rgba(0,240,255,0.5)" strokeWidth="1" />
        <path d="M0 15 L15 0" fill="none" stroke="rgba(0,240,255,0.3)" strokeWidth="0.5" />
      </svg>
      <svg className="absolute top-2 right-2 w-16 h-16 opacity-40 pointer-events-none" viewBox="0 0 100 100">
        <path d="M70 0 L100 0 L100 30" fill="none" stroke="rgba(0,240,255,0.5)" strokeWidth="1" />
        <path d="M85 0 L100 15" fill="none" stroke="rgba(0,240,255,0.3)" strokeWidth="0.5" />
      </svg>
      <svg className="absolute bottom-2 left-2 w-16 h-16 opacity-40 pointer-events-none" viewBox="0 0 100 100">
        <path d="M0 70 L0 100 L30 100" fill="none" stroke="rgba(0,240,255,0.5)" strokeWidth="1" />
      </svg>
      <svg className="absolute bottom-2 right-2 w-16 h-16 opacity-40 pointer-events-none" viewBox="0 0 100 100">
        <path d="M70 100 L100 100 L100 70" fill="none" stroke="rgba(0,240,255,0.5)" strokeWidth="1" />
      </svg>
    </>
  );
}

function IconButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
        active
          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-lg shadow-cyan-500/10'
          : 'text-gray-400 hover:text-cyan-300 hover:bg-white/5 border border-transparent'
      }`}
    >
      {icon}
    </button>
  );
}

function PrivacyDot({ label, color, pulse }: { label: string; color: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 glass rounded-full px-2 py-1">
      <span className={`w-2 h-2 rounded-full ${color} ${pulse ? 'status-dot' : ''}`} />
      <span className="text-[10px] font-mono text-gray-300 tracking-wider">{label}</span>
    </div>
  );
}

// Icons
function LiveScreenIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-red-400 animate-pulse' : 'currentColor'}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
      {active && <circle cx="12" cy="10" r="3" fill="currentColor" />}
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-300">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-300">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function MicMuteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function PhoneEndIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-300">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" x2="1" y1="1" y2="23" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function App() {
  useEffect(() => {
    document.title = 'TEJA AI — Desktop Assistant';
  }, []);

  return (
    <TejaProvider>
      <AppContent />
    </TejaProvider>
  );
}
