import React from 'react';
import { applyTheme } from './theme';

// ── SVG Logo Components ───────────────────────────────────────────────────────

export const CharlotteMedicalLogo = ({ size = 32, color = '#780606' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill={color} />
    {/* Medical cross */}
    <rect x="13" y="6" width="6" height="20" rx="2" fill="white" />
    <rect x="6" y="13" width="20" height="6" rx="2" fill="white" />
  </svg>
);

export const PiedmontHeartLogo = ({ size = 32, color = '#8b2635' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill={color} />
    {/* Heart shape */}
    <path
      d="M16 25 C16 25 6 18 6 11.5 C6 8.4 8.4 6 11.5 6 C13.2 6 14.8 6.8 16 8.1 C17.2 6.8 18.8 6 20.5 6 C23.6 6 26 8.4 26 11.5 C26 18 16 25 16 25Z"
      fill="white"
    />
    {/* ECG line overlaid */}
    <polyline
      points="8,15 11,15 12.5,11 14,19 15.5,13 17,15 19,15 20.5,12 22,15 24,15"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SouthParkOrthoLogo = ({ size = 32, color = '#2c5282' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill={color} />
    {/* Bone shape */}
    <g fill="white">
      {/* Bone shaft */}
      <rect x="10" y="14" width="12" height="4" rx="2" />
      {/* Left knobs */}
      <circle cx="9" cy="13" r="3" />
      <circle cx="9" cy="19" r="3" />
      {/* Right knobs */}
      <circle cx="23" cy="13" r="3" />
      <circle cx="23" cy="19" r="3" />
    </g>
  </svg>
);

export const CarolinaWomensLogo = ({ size = 32, color = '#5b3a8a' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill={color} />
    {/* Lotus flower */}
    <g fill="white">
      {/* Center petal */}
      <ellipse cx="16" cy="14" rx="3.5" ry="7" />
      {/* Left petal */}
      <ellipse cx="10.5" cy="16" rx="3" ry="6" transform="rotate(-35 10.5 16)" />
      {/* Right petal */}
      <ellipse cx="21.5" cy="16" rx="3" ry="6" transform="rotate(35 21.5 16)" />
      {/* Far left petal */}
      <ellipse cx="7" cy="19" rx="2.5" ry="5" transform="rotate(-60 7 19)" />
      {/* Far right petal */}
      <ellipse cx="25" cy="19" rx="2.5" ry="5" transform="rotate(60 25 19)" />
      {/* Base stem */}
      <rect x="15" y="23" width="2" height="4" rx="1" />
      {/* Base line */}
      <rect x="10" y="26" width="12" height="2" rx="1" />
    </g>
  </svg>
);

export const UptownPedsLogo = ({ size = 32, color = '#1a6b6b' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill={color} />
    {/* Star shape */}
    <polygon
      points="16,5 18.5,12.5 26.5,12.5 20.2,17.2 22.5,25 16,20.5 9.5,25 11.8,17.2 5.5,12.5 13.5,12.5"
      fill="white"
    />
    {/* Small cross in center */}
    <rect x="14.5" y="11.5" width="3" height="9" rx="1" fill={color} />
    <rect x="11.5" y="14.5" width="9" height="3" rx="1" fill={color} />
  </svg>
);

// ── Brand Registry ────────────────────────────────────────────────────────────

export const LOCATION_BRANDS = {
  'Charlotte Medical Center': {
    Logo: CharlotteMedicalLogo,
    color: '#780606',
    faviconColor: '#780606',
    custom: false,
  },
  'Piedmont Heart Institute': {
    Logo: PiedmontHeartLogo,
    color: '#8b2635',
    faviconColor: '#8b2635',
    custom: true,
  },
  'SouthPark Orthopedic': {
    Logo: SouthParkOrthoLogo,
    color: '#2c5282',
    faviconColor: '#2c5282',
    custom: true,
  },
  "Carolina Women's Health": {
    Logo: CarolinaWomensLogo,
    color: '#5b3a8a',
    faviconColor: '#5b3a8a',
    custom: true,
  },
  'Uptown Pediatrics': {
    Logo: UptownPedsLogo,
    color: '#1a6b6b',
    faviconColor: '#1a6b6b',
    custom: true,
  },
};

export const getBrand = (locationName) =>
  LOCATION_BRANDS[locationName] || LOCATION_BRANDS['Charlotte Medical Center'];

export const isCustomBranded = (locationName) =>
  !!locationName && LOCATION_BRANDS[locationName]?.custom === true;

// ── Favicon ───────────────────────────────────────────────────────────────────

const _logoSvgStrings = {
  'Charlotte Medical Center': (color) =>
    `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="${color}"/><rect x="13" y="6" width="6" height="20" rx="2" fill="white"/><rect x="6" y="13" width="20" height="6" rx="2" fill="white"/></svg>`,
  'Piedmont Heart Institute': (color) =>
    `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="${color}"/><path d="M16 25 C16 25 6 18 6 11.5 C6 8.4 8.4 6 11.5 6 C13.2 6 14.8 6.8 16 8.1 C17.2 6.8 18.8 6 20.5 6 C23.6 6 26 8.4 26 11.5 C26 18 16 25 16 25Z" fill="white"/><polyline points="8,15 11,15 12.5,11 14,19 15.5,13 17,15 19,15 20.5,12 22,15 24,15" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'SouthPark Orthopedic': (color) =>
    `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="${color}"/><rect x="10" y="14" width="12" height="4" rx="2" fill="white"/><circle cx="9" cy="13" r="3" fill="white"/><circle cx="9" cy="19" r="3" fill="white"/><circle cx="23" cy="13" r="3" fill="white"/><circle cx="23" cy="19" r="3" fill="white"/></svg>`,
  "Carolina Women's Health": (color) =>
    `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="${color}"/><ellipse cx="16" cy="14" rx="3.5" ry="7" fill="white"/><ellipse cx="10.5" cy="16" rx="3" ry="6" transform="rotate(-35 10.5 16)" fill="white"/><ellipse cx="21.5" cy="16" rx="3" ry="6" transform="rotate(35 21.5 16)" fill="white"/><rect x="15" y="23" width="2" height="4" rx="1" fill="white"/><rect x="10" y="26" width="12" height="2" rx="1" fill="white"/></svg>`,
  'Uptown Pediatrics': (color) =>
    `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="${color}"/><polygon points="16,5 18.5,12.5 26.5,12.5 20.2,17.2 22.5,25 16,20.5 9.5,25 11.8,17.2 5.5,12.5 13.5,12.5" fill="white"/><rect x="14.5" y="11.5" width="3" height="9" rx="1" fill="${color}"/><rect x="11.5" y="14.5" width="9" height="3" rx="1" fill="${color}"/></svg>`,
};

export const setFavicon = (locationName) => {
  const brand = getBrand(locationName);
  const svgFn = _logoSvgStrings[locationName] || _logoSvgStrings['Charlotte Medical Center'];
  const svg = svgFn(brand.faviconColor);
  const encoded = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = encoded;

  document.title = locationName ? `${locationName} | CommonCare` : 'CommonCare';
};

// ── Login page theming ────────────────────────────────────────────────────────

export const applyLoginTheme = (locationTheme) => {
  if (!locationTheme) return;
  applyTheme(locationTheme);
};
