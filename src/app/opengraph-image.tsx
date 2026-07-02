import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1d4ed8',
          fontFamily: 'sans-serif',
        }}
      >
        <svg width="180" height="180" viewBox="0 0 240 240" style={{ marginBottom: 40 }}>
          <rect width="240" height="240" rx="52" fill="#ffffff" />
          <g transform="translate(94,124)">
            <path d="M-58,-6 L-46,-46 L46,-46 L58,-6 Z" fill="#1d4ed8" />
            <rect x="-58" y="-10" width="116" height="12" rx="5" fill="#fbbf24" />
            <rect x="-46" y="-6" width="92" height="62" rx="4" fill="#1d4ed8" />
            <rect x="-13" y="18" width="26" height="38" fill="#ffffff" />
            <rect x="-36" y="6" width="18" height="18" rx="2" fill="#93c5fd" />
            <rect x="18" y="6" width="18" height="18" rx="2" fill="#93c5fd" />
          </g>
          <g transform="translate(154,140)">
            <circle cx="0" cy="0" r="40" fill="none" stroke="#1d4ed8" strokeWidth="14" />
            <line x1="28" y1="28" x2="62" y2="62" stroke="#1d4ed8" strokeWidth="16" strokeLinecap="round" />
          </g>
        </svg>
        <div style={{ display: 'flex', color: '#ffffff', fontSize: 96, fontWeight: 700 }}>
          ShopTutor
        </div>
        <div style={{ display: 'flex', color: '#bfdbfe', fontSize: 36, marginTop: 20 }}>
          MTG店舗レビューサイト
        </div>
      </div>
    ),
    { ...size }
  )
}
