import { useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTeja } from '../store/TejaContext';

/** Generate points on a sphere using golden-angle spiral */
function generateSpherePoints(count: number, radius: number): Array<{ x: number; y: number; z: number }> {
  const points: Array<{ x: number; y: number; z: number }> = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // -1 to 1
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    points.push({
      x: Math.cos(theta) * radiusAtY * radius,
      y: y * radius,
      z: Math.sin(theta) * radiusAtY * radius,
    });
  }
  return points;
}

// Color palettes per state
const STATE_COLORS: Record<string, { primary: string; secondary: string; glow: string; bg: string }> = {
  idle: { primary: '#40e0ff', secondary: '#0088ff', glow: 'rgba(0, 240, 255, 0.6)', bg: 'rgba(0, 136, 255, 0.15)' },
  listening: { primary: '#00ffff', secondary: '#40d0ff', glow: 'rgba(0, 255, 255, 0.8)', bg: 'rgba(0, 255, 255, 0.2)' },
  thinking: { primary: '#d080ff', secondary: '#8040ff', glow: 'rgba(200, 130, 255, 0.7)', bg: 'rgba(140, 60, 255, 0.2)' },
  acting: { primary: '#40ff90', secondary: '#00c060', glow: 'rgba(60, 255, 140, 0.7)', bg: 'rgba(40, 200, 100, 0.2)' },
  speaking: { primary: '#ffd060', secondary: '#ff8800', glow: 'rgba(255, 200, 60, 0.7)', bg: 'rgba(255, 160, 40, 0.2)' },
  error: { primary: '#ff6060', secondary: '#c00000', glow: 'rgba(255, 80, 80, 0.6)', bg: 'rgba(200, 40, 40, 0.2)' },
};

export function AIOrb() {
  const { state } = useTeja();
  const { state: assistantState, voiceLevel, isLiveSession } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  const colors = STATE_COLORS[assistantState] || STATE_COLORS.idle;
  const dotCount = 100;
  const baseRadius = 70;

  // Generate sphere points once
  const spherePoints = useMemo(() => generateSpherePoints(dotCount, baseRadius), []);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 320;
    canvas.width = size * 2; // retina
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(2, 2);

    const center = size / 2;
    let prevState = assistantState;
    let transitionProgress = 1;

    const animate = () => {
      timeRef.current += 0.016; // ~60fps
      const t = timeRef.current;

      // State transition
      if (prevState !== assistantState) {
        prevState = assistantState;
        transitionProgress = 0;
      }
      if (transitionProgress < 1) transitionProgress = Math.min(1, transitionProgress + 0.03);

      ctx.clearRect(0, 0, size, size);

      // Background glow
      const glowRadius = 100 + Math.sin(t * 0.8) * 15;
      const grad = ctx.createRadialGradient(center, center, 0, center, center, glowRadius);
      grad.addColorStop(0, colors.bg);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(center, center, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Rotation speed varies by state
      let rotSpeed = 0.3;
      if (assistantState === 'thinking') rotSpeed = 1.2;
      else if (assistantState === 'acting') rotSpeed = 0.8;
      else if (assistantState === 'speaking') rotSpeed = 0.5;
      else if (assistantState === 'listening') rotSpeed = 0.4;
      else if (assistantState === 'error') rotSpeed = 0.1;

      const rotY = t * rotSpeed;
      const rotX = Math.sin(t * 0.2) * 0.3;

      // Sort points by Z for back-to-front rendering
      const projected = spherePoints.map((p, i) => {
        let { x, y, z } = p;

        // Rotate Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const rx = x * cosY - z * sinY;
        const rz = x * sinY + z * cosY;
        x = rx;
        z = rz;

        // Rotate X (tilt)
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const ry = y * cosX - z * sinX;
        const rz2 = y * sinX + z * cosX;
        y = ry;
        z = rz2;

        // State-specific deformations
        let deformX = 0, deformY = 0;

        if (assistantState === 'listening' || assistantState === 'speaking') {
          // Voice-reactive: dots expand/contract with voice level
          const voiceScale = 1 + voiceLevel * 0.4;
          // Sinusoidal wave propagation
          const wavePhase = (i * 0.08) + t * 3;
          const wave = Math.sin(wavePhase) * voiceLevel * 12;
          const normalLen = Math.sqrt(x * x + y * y + z * z) || 1;
          deformX = (x / normalLen) * wave;
          deformY = (y / normalLen) * wave;
          x *= voiceScale;
          y *= voiceScale;
          z *= voiceScale;
        } else if (assistantState === 'thinking') {
          // Pulsating expansion
          const pulse = Math.sin(t * 2 + i * 0.1) * 8;
          const normalLen = Math.sqrt(x * x + y * y + z * z) || 1;
          x += (x / normalLen) * pulse;
          y += (y / normalLen) * pulse;
          z += (z / normalLen) * pulse;
        } else if (assistantState === 'acting') {
          // Directional flow — dots shift in waves
          const flowWave = Math.sin(t * 3 + y * 0.05) * 6;
          deformX = flowWave;
        } else if (assistantState === 'error') {
          // Jitter/shake
          deformX = (Math.random() - 0.5) * 6;
          deformY = (Math.random() - 0.5) * 6;
        }

        // Perspective projection
        const perspective = 300;
        const scale = perspective / (perspective + z);
        const screenX = center + (x + deformX) * scale;
        const screenY = center + (y + deformY) * scale;

        return { screenX, screenY, z, scale, index: i };
      });

      // Sort back-to-front
      projected.sort((a, b) => a.z - b.z);

      // Draw dots
      for (const dot of projected) {
        const depth = (dot.z + baseRadius) / (baseRadius * 2); // 0 = back, 1 = front
        const alpha = 0.2 + depth * 0.8;
        const dotSize = (1.5 + depth * 3) * dot.scale;

        // Color interpolation based on depth and state
        ctx.globalAlpha = alpha * transitionProgress + (1 - transitionProgress) * 0.3;

        // Glow for front-facing dots
        if (depth > 0.6) {
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 6 + depth * 8;
        } else {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = depth > 0.5 ? colors.primary : colors.secondary;

        ctx.beginPath();
        ctx.arc(dot.screenX, dot.screenY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [assistantState, voiceLevel, spherePoints, colors]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 420, height: 420 }}>
      {/* Outer decorative SVG rings */}
      <svg
        className="absolute ring-rotate pointer-events-none"
        width={360}
        height={360}
        viewBox="0 0 400 400"
        style={{ opacity: isLiveSession ? 0.7 : 0.3 }}
      >
        <circle cx="200" cy="200" r="190" fill="none" stroke={colors.primary} strokeWidth="0.5" strokeDasharray="4 8" strokeOpacity="0.4" />
        <circle cx="200" cy="200" r="175" fill="none" stroke={colors.secondary} strokeWidth="0.5" strokeDasharray="2 6" strokeOpacity="0.3" />
      </svg>

      {/* Inner reverse ring */}
      <div
        className="absolute rounded-full ring-rotate-reverse pointer-events-none"
        style={{
          width: 280,
          height: 280,
          border: `1px solid ${colors.primary}22`,
        }}
      >
        {[0, 90, 180, 270].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * 140;
          const y = Math.sin(rad) * 140;
          return (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                top: `calc(50% + ${y}px - 3px)`,
                left: `calc(50% + ${x}px - 3px)`,
                backgroundColor: colors.primary,
                boxShadow: `0 0 6px ${colors.glow}`,
              }}
            />
          );
        })}
      </div>

      {/* Speaking pulse rings */}
      <AnimatePresence>
        {assistantState === 'speaking' && (
          <>
            <div className="absolute rounded-full border-2 speaking-pulse-ring pointer-events-none"
              style={{ width: 180, height: 180, borderColor: `${colors.primary}80` }} />
            <div className="absolute rounded-full border speaking-pulse-ring-delayed pointer-events-none"
              style={{ width: 180, height: 180, borderColor: `${colors.primary}50` }} />
            <div className="absolute rounded-full border speaking-pulse-ring-delayed2 pointer-events-none"
              style={{ width: 180, height: 180, borderColor: `${colors.primary}30` }} />
          </>
        )}
      </AnimatePresence>

      {/* Thinking halo */}
      <AnimatePresence>
        {assistantState === 'thinking' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute rounded-full thinking-halo pointer-events-none"
            style={{ width: 220, height: 220, border: `1px solid ${colors.primary}60` }}
          />
        )}
      </AnimatePresence>

      {/* Acting directional arrows */}
      <AnimatePresence>
        {assistantState === 'acting' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 220,
              height: 220,
              border: `1px dashed ${colors.primary}40`,
              animation: 'ring-rotate 4s linear infinite',
            }}
          />
        )}
      </AnimatePresence>

      {/* DOT SPHERE CANVAS */}
      <canvas
        ref={canvasRef}
        className="relative pointer-events-none"
        style={{ width: 320, height: 320 }}
      />

      {/* LIVE indicator */}
      <AnimatePresence>
        {isLiveSession && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute flex items-center gap-2 pointer-events-none"
            style={{ top: 20 }}
          >
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            </div>
            <span className="text-xs font-bold tracking-[0.2em] text-red-400 uppercase font-mono">
              LIVE
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice waveform bars (speaking + listening) */}
      <AnimatePresence>
        {(assistantState === 'speaking' || assistantState === 'listening') && voiceLevel > 0.02 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute flex items-end justify-center gap-[2px] pointer-events-none"
            style={{ bottom: 30, height: 50 }}
          >
            {Array.from({ length: 24 }).map((_, i) => {
              const center = 11.5;
              const distFromCenter = Math.abs(i - center) / center;
              const archFactor = 1 - distFromCenter * distFromCenter;
              const reactiveH = voiceLevel * 40 * archFactor;
              const baseH = 3 + archFactor * 8;
              const barHeight = Math.max(3, baseH + reactiveH);
              const alpha = 0.4 + archFactor * 0.6;

              return (
                <div
                  key={i}
                  className="rounded-full transition-all duration-75 ease-out"
                  style={{
                    width: 2.5,
                    height: barHeight,
                    background: `linear-gradient(to top, ${colors.secondary}${Math.round(alpha * 100).toString(16).padStart(2, '0')}, ${colors.primary}${Math.round(alpha * 255).toString(16).padStart(2, '0')})`,
                    boxShadow: voiceLevel > 0.25 ? `0 -2px 6px ${colors.glow}` : 'none',
                  }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
