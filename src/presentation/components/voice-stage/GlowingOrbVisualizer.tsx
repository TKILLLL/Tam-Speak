import React from 'react';
import { motion } from 'framer-motion';
import { OrbState } from '../../store';

interface GlowingOrbVisualizerProps {
  orbState: OrbState;
  audioLevel: number; // 0.0 to 1.0 from AnalyserNode
}

export const GlowingOrbVisualizer: React.FC<GlowingOrbVisualizerProps> = ({
  orbState,
  audioLevel,
}) => {
  // Compute dynamic scale and glow based on actual mic amplitude when listening
  const dynamicScale = orbState === 'listening' ? 1 + audioLevel * 0.45 : 1;
  const dynamicGlow = orbState === 'listening' ? 25 + audioLevel * 50 : 25;

  return (
    <div className="relative flex items-center justify-center w-64 h-64 select-none my-4">
      {/* Outer Glow Halo */}
      <motion.div
        animate={
          orbState === 'idle'
            ? { scale: [1, 1.08, 1], opacity: [0.4, 0.6, 0.4] }
            : orbState === 'listening'
            ? { scale: dynamicScale * 1.15, opacity: 0.7 }
            : orbState === 'thinking'
            ? { rotate: 360, opacity: [0.5, 0.8, 0.5] }
            : { scale: [1, 1.12, 1], opacity: [0.6, 0.9, 0.6] }
        }
        transition={
          orbState === 'thinking'
            ? { repeat: Infinity, duration: 3, ease: 'linear' }
            : orbState === 'listening'
            ? { type: 'spring', damping: 15, stiffness: 300 }
            : { repeat: Infinity, duration: 4, ease: 'easeInOut' }
        }
        style={{
          filter: `blur(${dynamicGlow}px)`,
        }}
        className="absolute w-48 h-48 rounded-full bg-gradient-to-tr from-teal-500 via-cyan-400 to-sky-300 pointer-events-none"
      />

      {/* Ripple wave when speaking or listening loudly */}
      {(orbState === 'speaking' || (orbState === 'listening' && audioLevel > 0.3)) && (
        <motion.div
          animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
          className="absolute w-44 h-44 rounded-full border border-cyan-400/60 pointer-events-none"
        />
      )}

      {/* Main Core Orb Body */}
      <motion.div
        animate={
          orbState === 'idle'
            ? { scale: [1, 1.03, 1] }
            : orbState === 'listening'
            ? { scale: dynamicScale }
            : orbState === 'thinking'
            ? { rotate: 360 }
            : { scale: [1, 1.06, 0.98, 1] }
        }
        transition={
          orbState === 'thinking'
            ? { repeat: Infinity, duration: 2.2, ease: 'linear' }
            : orbState === 'listening'
            ? { type: 'spring', damping: 20, stiffness: 400 }
            : { repeat: Infinity, duration: 3.2, ease: 'easeInOut' }
        }
        className="relative w-44 h-44 rounded-full shadow-2xl flex items-center justify-center overflow-hidden cursor-pointer"
        style={{
          background:
            orbState === 'thinking'
              ? 'radial-gradient(circle at 35% 35%, #5EEAD4 0%, #0D9488 60%, #115E59 100%)'
              : 'radial-gradient(circle at 35% 35%, #67E8F9 0%, #2DD4BF 45%, #0F766E 100%)',
          boxShadow: `0 0 35px rgba(13, 148, 136, 0.5), inset 0 0 25px rgba(255, 255, 255, 0.4)`,
        }}
      >
        {/* Inner Liquid Texture / Highlights */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/20 rounded-full pointer-events-none" />

        {/* Ambient Orb Center Light */}
        <motion.div
          animate={
            orbState === 'thinking'
              ? { scale: [0.8, 1.2, 0.8], opacity: [0.6, 1, 0.6] }
              : { scale: [1, 1.1, 1], opacity: [0.7, 0.9, 0.7] }
          }
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="w-16 h-16 rounded-full bg-white/40 blur-xs"
        />
      </motion.div>

      {/* Dynamic Status Indicator Tag */}
      <div className="absolute -bottom-7">
        <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
          {orbState === 'idle' && 'Ready • Hold Space'}
          {orbState === 'listening' && 'Listening...'}
          {orbState === 'thinking' && 'AI Thinking...'}
          {orbState === 'speaking' && 'AI Speaking...'}
        </span>
      </div>
    </div>
  );
};
