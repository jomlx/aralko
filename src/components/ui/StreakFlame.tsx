import React, { useId } from 'react';

export interface StreakFlameProps {
  stage: number; // 0 to 5
  locked?: boolean;
  animated?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const PATHS = [
  // 0 (same as 1 but uses locked colors if passed)
  'M34 6C35 18 44 26 50 38C56 50 54 62 48 68C44 73 38 76 32 76C26 76 20 73 16 68C10 62 8 52 14 40C18 32 24 30 28 22C31 16 33 12 34 6Z',
  // 1
  'M34 6C35 18 44 26 50 38C56 50 54 62 48 68C44 73 38 76 32 76C26 76 20 73 16 68C10 62 8 52 14 40C18 32 24 30 28 22C31 16 33 12 34 6Z',
  // 2
  'M40 4C41 14 46 20 51 30C57 42 57 54 54 60C50 70 42 76 32 76C18 76 8 66 8 54C8 42 12 32 14 22C17 30 20 36 25 40C24 28 30 14 40 4Z',
  // 3
  'M32 4C34 14 40 18 42 24C44 22 46 20 49 18C49 26 52 32 55 38C58 46 58 54 56 58C52 70 44 76 32 76C18 76 8 66 8 54C8 44 11 36 14 26C16 32 19 35 22 36C21 24 27 14 32 4Z',
  // 4
  'M36 4C37 12 41 16 42 22C44 20 47 18 50 16C50 25 53 30 55 36C58 44 58 52 56 58C52 70 44 76 32 76C18 76 8 66 8 54C8 46 10 40 12 32C14 37 17 39 20 39C18 30 21 22 25 14C26 20 28 23 31 24C30 16 32 9 36 4Z',
  // 5
  'M34 4C35 12 38 16 39 21C41 18 44 15 47 14C47 22 50 27 52 32C54 31 56 30 57 28C58 36 60 44 58 54C55 68 46 76 32 76C18 76 8 66 8 54C8 48 9 44 9 38C11 42 14 44 17 44C15 34 17 26 21 18C23 24 26 28 29 29C28 19 30 10 34 4Z'
];

const GRADIENTS = [
  { start: '#9AA0A8', end: '#D2D5DA' }, // 0 or locked
  { start: '#FFC94D', end: '#FFF0A0' }, // 1
  { start: '#FF8A1F', end: '#FFC233' }, // 2
  { start: '#FF6B45', end: '#FFA24D' }, // 3
  { start: '#F5588B', end: '#FF7A7A' }, // 4
  { start: '#B38CFF', end: '#FF9BE8' }, // 5
];

const DURATIONS = ['1.8s', '1.6s', '1.4s', '1.2s', '1.0s', '1.0s'];

export function StreakFlame({ stage, locked = false, animated = false, className, style, ...props }: StreakFlameProps & React.SVGProps<SVGSVGElement>) {
  const id = useId();
  const clampedStage = Math.max(0, Math.min(5, stage));
  
  // Use stage 0 for locked/none
  const effectiveStage = (clampedStage === 0 || locked) ? 0 : clampedStage;
  const path = PATHS[effectiveStage === 0 ? 1 : clampedStage]; // Path 1 is used for 0/locked
  const grad = GRADIENTS[effectiveStage];
  const duration = DURATIONS[effectiveStage === 0 ? 0 : clampedStage];

  const animateClass = animated && !locked ? 'animate-flame-flicker-hero' : '';
  const coreOpacityClass = animated && !locked ? 'animate-flame-pulse' : '';

  return (
    <svg viewBox="0 0 64 80" className={className} style={style} {...props}>
      <defs>
        <linearGradient id={`flame-grad-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="76">
          <stop offset="0%" stopColor={grad.start} />
          <stop offset="100%" stopColor={grad.end} />
        </linearGradient>
      </defs>
      <g className={animateClass} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%', animationDuration: duration }}>
        <path d={path} fill={`url(#flame-grad-${id})`} />
        <path 
          d="M32 44C37 51 42 55 42 62C42 68 37 72 32 72C27 72 22 68 22 62C22 55 27 51 32 44Z" 
          fill="white" 
          fillOpacity={locked ? 0.45 : 0.55}
          className={coreOpacityClass}
          style={{ animationDuration: duration }}
        />
      </g>
    </svg>
  );
}
