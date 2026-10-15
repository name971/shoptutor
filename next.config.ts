import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 旧タブのURL（ブックマーク・外部リンク）を新しいタブ構成へ転送する
  async redirects() {
    return [
      { source: '/events', destination: '/', permanent: false },
      { source: '/map', destination: '/shops?view=map', permanent: false },
    ]
  },
  experimental: {
    staleTimes: {
      dynamic: 300,
    },
  },
};

export default nextConfig;
