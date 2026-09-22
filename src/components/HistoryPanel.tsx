import { motion } from 'framer-motion';
import { useTeja } from '../store/TejaContext';

export function HistoryPanel() {
  const { state, dispatch } = useTeja();
  const { history } = state;

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <motion.div
      className="glass rounded-xl p-5 w-80 max-h-[70vh] overflow-y-auto"
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cyan-400 font-semibold tracking-widest text-sm uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          Command History
        </h3>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'CLEAR_HISTORY' })}
            className="text-[10px] font-mono text-gray-400 hover:text-red-400 uppercase tracking-widest transition-colors"
          >
            [Clear]
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-8">
          No commands yet.
          <div className="text-xs mt-2 text-gray-600">Try saying "Hey Teja" or press Ctrl+Space</div>
        </div>
      ) : (
        <div className="space-y-4">
          {history.slice(0, 20).map(entry => (
            <div key={entry.id} className="border-l-2 border-cyan-500/30 pl-3">
              <div className="text-[10px] text-cyan-400/60 font-mono tracking-wider mb-1">
                {formatTime(entry.timestamp)}
              </div>
              <div className="text-sm text-gray-200 mb-1">"{entry.userQuery}"</div>
              <div className="text-xs text-gray-400 line-clamp-2">{entry.aiResponse}</div>
              {entry.toolUsed && (
                <div className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                  ⚡ {entry.toolUsed}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
