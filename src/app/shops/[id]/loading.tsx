import { SkeletonBlock, EventRowSkeleton } from '@/components/ui/Skeleton'

// 店舗詳細の読み込み中表示（サーバー側でデータ取得している間に出る）
export default function Loading() {
  return (
    <div className="min-h-screen bg-background pb-28" role="status" aria-label="読み込み中">
      <div className="app-header sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center">
          <SkeletonBlock className="h-4 w-40" />
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="surface p-4 flex flex-col gap-3">
          <SkeletonBlock className="h-5 w-28 rounded-full" />
          <SkeletonBlock className="h-7 w-3/4" />
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-16 w-full rounded-xl" />
        </div>
        <EventRowSkeleton />
        <EventRowSkeleton />
      </div>
    </div>
  )
}
