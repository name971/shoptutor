// 読み込み中の仮表示。実際のカードと同じ形のグレーの帯を並べる
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />
}

export function ShopCardSkeleton() {
  return (
    <div className="surface p-4 flex flex-col gap-2.5" aria-hidden>
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="h-5 w-3/4" />
      <SkeletonBlock className="h-3.5 w-1/2" />
      <div className="flex gap-1.5">
        <SkeletonBlock className="h-5 w-20 rounded-full" />
        <SkeletonBlock className="h-5 w-16 rounded-full" />
      </div>
    </div>
  )
}

export function EventRowSkeleton() {
  return (
    <div className="surface p-3 flex gap-3" aria-hidden>
      <SkeletonBlock className="w-14 h-10 flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <SkeletonBlock className="h-4 w-2/3" />
        <SkeletonBlock className="h-3 w-1/2" />
        <SkeletonBlock className="h-4 w-20 rounded-full" />
      </div>
    </div>
  )
}

// 一覧の読み込み中表示（スクリーンリーダーには「読み込み中」とだけ伝える）
export function SkeletonList({ count = 4, kind }: { count?: number; kind: 'shop' | 'event' }) {
  const Item = kind === 'shop' ? ShopCardSkeleton : EventRowSkeleton
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="読み込み中">
      {Array.from({ length: count }, (_, i) => (
        <Item key={i} />
      ))}
    </div>
  )
}
