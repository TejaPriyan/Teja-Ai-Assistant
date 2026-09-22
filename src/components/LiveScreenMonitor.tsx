import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { screenCapture } from '../services/screenCapture';

interface LiveScreenMonitorProps {
  onAnalyze: (prompt?: string) => void;
  onClose: () => void;
}

export function LiveScreenMonitor({ onAnalyze, onClose }: LiveScreenMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const stream = screenCapture.getLiveStream();
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }

    const unsub = screenCapture.onStreamEnded(() => {
      onClose();
    });

    return () => {
      unsub();
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      className="fixed bottom-24 right-6 z-40 glass rounded-xl border border-cyan-400/40 shadow-2xl overflow-hidden backdrop-blur-xl"
      style={{ width: isMinimized ? 220 : 300 }}
    >
      {/* HUD Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-mono tracking-widest text-cyan-300 uppercase">
            LIVE SCREEN
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-[10px] font-mono text-gray-400 hover:text-cyan-300 px-1"
            title={isMinimized ? 'Expand view' : 'Minimize view'}
          >
            {isMinimized ? '▢' : '–'}
          </button>
          <button
            onClick={() => {
              screenCapture.stopLiveStream();
              onClose();
            }}
            className="text-[10px] font-mono text-gray-400 hover:text-red-400 px-1"
            title="Stop screen sharing"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Video stream container */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative bg-black/80 aspect-video flex items-center justify-center overflow-hidden"
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Sci-fi crosshair overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="w-full h-full border border-cyan-400/50 m-1" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border-t border-l border-cyan-300" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Action Footer */}
      <div className="p-2 bg-black/50 flex items-center justify-between gap-2 border-t border-cyan-500/10">
        <button
          onClick={() => onAnalyze("What's on my screen right now? Describe what I'm looking at.")}
          className="flex-1 py-1 px-2.5 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-200 border border-cyan-400/40 rounded text-[10px] font-mono uppercase tracking-wider transition-all"
        >
          ⚡ Ask AI What's Here
        </button>
        <button
          onClick={() => {
            screenCapture.stopLiveStream();
            onClose();
          }}
          className="py-1 px-2 text-gray-400 hover:text-red-400 text-[10px] font-mono uppercase tracking-wider"
        >
          Stop
        </button>
      </div>
    </motion.div>
  );
}
