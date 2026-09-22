import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTeja } from '../store/TejaContext';

export function ChatPanel({ onSend }: { onSend: (text: string) => void }) {
  const { state, dispatch } = useTeja();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.chatMessages.length]);

  const isProcessing = state.state === 'thinking' || state.state === 'speaking' || state.state === 'listening';

  return (
    <motion.div
      className="glass rounded-xl w-[440px] max-h-[65vh] flex flex-col shadow-2xl"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="p-4 border-b border-cyan-500/10 flex items-center justify-between">
        <h3 className="text-cyan-400 font-semibold tracking-widest text-sm uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          Conversation
        </h3>
        {state.chatMessages.length > 0 && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'CLEAR_CHAT' })}
            className="text-[10px] font-mono text-gray-400 hover:text-red-400 uppercase tracking-widest transition-colors"
            title="Clear conversation"
          >
            [Clear]
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px] max-h-[380px] pr-2">
        {state.chatMessages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-12">
            <div className="text-4xl mb-3">💬</div>
            <div>Start typing or press the mic button to speak.</div>
            <div className="text-xs mt-2 text-gray-600">You can also press Ctrl+Space to talk</div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {state.chatMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30 rounded-br-sm'
                      : 'bg-white/5 text-gray-200 border border-white/10 rounded-bl-sm'
                  }`}
                >
                  <div className="text-[9px] opacity-50 font-mono mb-1">
                    {msg.role === 'user' ? 'YOU' : 'TEJA'} · {msg.time}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-cyan-500/10 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={isProcessing ? 'Waiting for response...' : 'Type a message...'}
          disabled={isProcessing}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all disabled:opacity-50"
          autoFocus
        />
        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </motion.div>
  );
}
