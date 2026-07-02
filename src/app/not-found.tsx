import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4 pb-16 text-center">
      <div className="text-5xl">🔍</div>
      <div>
        <h1 className="text-xl font-bold text-gray-800">ページが見つかりません</h1>
        <p className="mt-2 text-sm text-gray-500">
          お探しのページは移動または削除された可能性があります。
        </p>
      </div>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        ホームに戻る
      </Link>
    </div>
  )
}
