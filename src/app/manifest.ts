import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ShopTutor | MTG店舗レビューサイト',
    short_name: 'ShopTutor',
    description: 'マジック：ザ・ギャザリングの店舗約563店舗の口コミ・イベント情報をチェックできるレビューサイト',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#1d4ed8',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
