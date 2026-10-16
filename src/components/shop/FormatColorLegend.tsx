import { FORMAT_FILTER_OPTIONS, FORMAT_HEX } from '@/types'

// 店舗カードの色の帯（遊ばれているフォーマットの内訳）の凡例。一覧の上に1回だけ出す
export default function FormatColorLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-x-2.5 gap-y-1 flex-wrap text-[11px] text-slate-600 ${className}`} aria-label="色の帯＝週に開かれているフォーマットの割合">
      <span className="text-slate-500">色の帯＝フォーマットの割合：</span>
      {FORMAT_FILTER_OPTIONS.map((f) => (
        <span key={f.key} className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className="w-3 h-1.5 rounded-full" style={{ background: FORMAT_HEX[f.key] }} />
          {f.label}
        </span>
      ))}
    </div>
  )
}
