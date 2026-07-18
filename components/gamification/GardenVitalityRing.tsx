import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  level: number;
  exp: number;
  healthStatus?: 'Excelent' | 'Bun' | 'Atenție';
}

export const GardenVitalityRing: React.FC<Props> = ({ level, exp, healthStatus = 'Excelent' }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  // Calculate percentage of progress in current level. (Max exp arbitrarily set to 1000 for visual)
  const progress = Math.min(100, (exp % 1000) / 10);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const color = healthStatus === 'Excelent' ? '#10b981' : healthStatus === 'Bun' ? '#3b82f6' : '#f59e0b';

  return (
    <div className="relative flex items-center justify-center p-8">
      {/* Background Glow */}
      <div 
        className="absolute w-32 h-32 rounded-full blur-2xl opacity-20"
        style={{ backgroundColor: color }}
      />
      
      <svg width="160" height="160" className="transform -rotate-90">
        {/* Track */}
        <circle
          cx="80"
          cy="80"
          r={radius}
          className="stroke-border-color"
          strokeWidth="8"
          fill="transparent"
        />
        {/* Progress */}
        <motion.circle
          cx="80"
          cy="80"
          r={radius}
          stroke={color}
          strokeWidth="10"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      </svg>

      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">
          Nivel {level}
        </span>
        <motion.span 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-2xl font-black text-main drop-shadow-md"
        >
          {healthStatus}
        </motion.span>
        <span className="text-[10px] font-medium text-text-secondary mt-1">
          {exp} XP
        </span>
      </div>
    </div>
  );
};
