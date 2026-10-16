import Link from 'next/link'
import { SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4 pb-24 text-center">
      <span className="w-16 h-16 rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5 text-slate-400 flex items-center justify-center">
        <SearchX size={28} />
      </span>
      <div>
        <h1 className="font-display text-2xl text-slate-900">ページが見つかりません</h1>
        <p className="mt-2 text-sm text-slate-500">
          お探しのページは移動または削除された可能性があります。
        </p>
      </div>
      <div className="mt-2 flex gap-2">
        <Link
          href="/"
          className="h-11 px-5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 transition-colors inline-flex items-center"
        >
          イベントを見る
        </Link>
        <Link
          href="/shops"
          className="h-11 px-5 rounded-xl bg-white text-sm font-bold text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 inline-flex items-center"
        >
          店舗をさがす
        </Link>
      </div>
    </div>
  )
}
