import type { Metadata } from "next";
import { M_PLUS_2, Dela_Gothic_One } from "next/font/google";
import "./globals.css";
import BottomNavGate from "@/components/layout/BottomNavGate";

// 日本語フォントはGoogle Fonts側で文字ごとに細かく分割されており、ブラウザは画面に出る文字を含むファイルだけを読み込む。
// next/fontでVercelから配信し（Googleへの通信なし）、全分割ファイルを先読みしないようpreloadは無効にする
// 本文・UI：M PLUS 2（1ファイルで細字〜極太まで出せる可変フォント）
const mPlus2 = M_PLUS_2({
  variable: "--font-mplus2",
  weight: "variable",
  display: "swap",
  preload: false,
});

// ロゴ・大見出しだけに使う極太の見出し用フォント（太さは1種類のみ）
const delaGothicOne = Dela_Gothic_One({
  variable: "--font-dela-gothic",
  weight: "400",
  display: "swap",
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const siteName = "ShopTutor";
const siteDescription =
  "マジック：ザ・ギャザリングの全国の公認店舗の口コミ・イベント情報をチェックできるレビューサイト";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | MTG店舗レビューサイト`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  openGraph: {
    title: `${siteName} | MTG店舗レビューサイト`,
    description: siteDescription,
    url: siteUrl,
    siteName,
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} | MTG店舗レビューサイト`,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${mPlus2.variable} ${delaGothicOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BottomNavGate />
      </body>
    </html>
  );
}
