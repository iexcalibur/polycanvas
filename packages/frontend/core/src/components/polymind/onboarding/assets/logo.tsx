import { memo } from 'react';

/**
 * PolyCanvas mark. Keep in sync with `/polycanvas-logo.svg` and the favicon
 * generator in `scripts/generate-icons.py`.
 */
export default memo(function Logo() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="pc-logo-bg"
          x1="0"
          y1="0"
          x2="120"
          y2="120"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill="url(#pc-logo-bg)" />
      <rect
        x="22"
        y="30"
        width="60"
        height="48"
        rx="8"
        stroke="#FFFFFF"
        strokeOpacity="0.55"
        strokeWidth="5"
      />
      <rect
        x="38"
        y="42"
        width="60"
        height="48"
        rx="8"
        stroke="#FFFFFF"
        strokeWidth="6"
      />
      <path
        d="M50 66 L86 66"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="66" r="7" fill="#FFFFFF" />
      <circle cx="86" cy="66" r="7" fill="#FFFFFF" />
    </svg>
  );
});
