import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

function useSystemStats() {
  const [stats, setStats] = useState({ cpu: 0, ram: 0, fps: 60 });

  useEffect(() => {
    const mem = (performance as any).memory;
    let lastTime = performance.now();
    let frames = 0;
    let fps = 60;

    const interval = setInterval(() => {
      // Simple synthetic stats
      const ramUsed = mem ? Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100) : 20 + Math.random() * 15;
      const cpuLoad = Math.round(10 + Math.random() * 25);

      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        fps = frames;
        frames = 0;
        lastTime = now;
      }

      setStats({ cpu: cpuLoad, ram: ramUsed, fps });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return stats;
}

export function SystemPanel() {
  const { cpu, ram, fps } = useSystemStats();

  return (
    <motion.div
      className="glass rounded-xl p-5 w-72"
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <h3 className="text-cyan-400 font-semibold tracking-widest text-sm mb-4 uppercase flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        System Information
      </h3>

      <div className="space-y-4">
        <StatBar label="CPU" value={cpu} unit="%" color="cyan" />
        <StatBar label="RAM" value={ram} unit="%" color="blue" />
        <StatBar label="FPS" value={fps} unit="fps" color="emerald" max={120} />

        <div className="pt-3 border-t border-cyan-500/10 space-y-2">
          <InfoRow label="Platform" value={navigator.platform || 'Unknown'} />
          <InfoRow label="Cores" value={String(navigator.hardwareConcurrency || 'N/A')} />
          <InfoRow label="Network" value={navigator.onLine ? 'Connected' : 'Offline'} />
          <InfoRow label="User Agent" value={navigator.userAgent.split(' ')[0]} />
        </div>
      </div>
    </motion.div>
  );
}

function StatBar({ label, value, unit, color, max = 100 }: { label: string; value: number; unit: string; color: string; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const colorMap: Record<string, string> = {
    cyan: 'from-cyan-400 to-cyan-600',
    blue: 'from-blue-400 to-blue-600',
    emerald: 'from-emerald-400 to-emerald-600',
  };

  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-400 font-mono tracking-wider">{label}</span>
        <span className="text-gray-200 font-mono">{value}{unit}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${colorMap[color]} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500 font-mono tracking-wider">{label}</span>
      <span className="text-gray-300 font-mono truncate ml-4 max-w-[150px]" title={value}>{value}</span>
    </div>
  );
}
