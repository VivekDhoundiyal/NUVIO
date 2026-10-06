import React from 'react';

export interface NuvioLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
  showTagline?: boolean;
}

export const NuvioLogo: React.FC<NuvioLogoProps> = ({
  variant = 'full',
  size = 'md',
  animated = false,
  className = '',
  showTagline = false,
}) => {
  // Size dimensions
  const iconDimensions = {
    sm: { width: 24, height: 24 },
    md: { width: 32, height: 32 },
    lg: { width: 44, height: 44 },
    xl: { width: 60, height: 60 },
  }[size];

  const textClasses = {
    sm: 'text-base',
    md: 'text-xl tracking-tight',
    lg: 'text-2xl tracking-tight font-extrabold',
    xl: 'text-3xl tracking-tight font-extrabold',
  }[size];

  const taglineClasses = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-sm',
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className} ${
        animated ? 'hover:scale-105 transition-transform duration-200' : ''
      }`}
    >
      {/* Geometric Folded Document SVG Icon */}
      <svg
        width={iconDimensions.width}
        height={iconDimensions.height}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${animated ? 'animate-nuvio-fold' : ''}`}
        aria-label="Nuvio Icon"
      >
        <defs>
          <linearGradient id="nuvio-grad-primary" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5B5CEB" />
            <stop offset="100%" stopColor="#7C5CFF" />
          </linearGradient>
          <linearGradient id="nuvio-grad-accent" x1="16" y1="4" x2="36" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#27C7D9" />
            <stop offset="100%" stopColor="#5B5CEB" />
          </linearGradient>
          <linearGradient id="nuvio-grad-fold" x1="12" y1="18" x2="28" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3C3AC4" />
            <stop offset="100%" stopColor="#2C2B81" />
          </linearGradient>
          <filter id="nuvio-subtle-shadow" x="0" y="0" width="40" height="40" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#5B5CEB" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Back document base sheet */}
        <rect
          x="6"
          y="5"
          width="23"
          height="30"
          rx="5"
          fill="url(#nuvio-grad-primary)"
        />

        {/* Dynamic Fold Facet forming stylized 'N' geometric fold */}
        <path
          d="M15 5L29 20V35L15 20V5Z"
          fill="url(#nuvio-grad-fold)"
          opacity="0.85"
        />

        {/* Front folding paper facet with Cyan-Indigo aurora gradient */}
        <path
          d="M13 10L33 22C34.5 22.8 34.5 25.2 33 26L21 34C19.5 35 17 34 17 32.2V11.8C17 10.2 11.5 9.1 13 10Z"
          fill="url(#nuvio-grad-accent)"
        />

        {/* Document fold corner crease highlight */}
        <path
          d="M23 5L29 11H25C23.8954 11 23 10.1046 23 9V5Z"
          fill="#FFFFFF"
          opacity="0.75"
        />

        {/* Crisp precision inner dot accent */}
        <circle cx="13" cy="28" r="2.2" fill="#FFFFFF" opacity="0.9" />
      </svg>

      {/* Typography for Full variant */}
      {variant === 'full' && (
        <div className="flex flex-col justify-center leading-none">
          <div className="flex items-center gap-1.5">
            <span className={`font-bold tracking-tight text-nuvio-ink dark:text-white ${textClasses}`}>
              NUVIO
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-nuvio-cyan animate-pulse" />
          </div>
          {showTagline && (
            <span className={`text-nuvio-muted dark:text-nuvio-darkMuted font-medium tracking-normal mt-0.5 ${taglineClasses}`}>
              Done in seconds
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default NuvioLogo;
