import { ChevronRight, History } from 'lucide-react'

type Props = {
  regions: { name: string; prefectures: string[] }[]
  // 都道府県ごとの店舗数（フォーマットなどの条件を反映したもの）
  counts: Map<string, number>
  total: number
  loading: boolean
  lastPrefecture: string | null
  onSelect: (prefecture: string) => void
  onBrowseAll: () => void
}

// 「東京都」→「東京」、「北海道」はそのまま（タイルを短く読みやすくする）
function shortName(prefecture: string) {
  return prefecture === '北海道' ? prefecture : prefecture.replace(/[都府県]$/, '')
}

// 店舗タブの入口。MTGの店舗は主要な街に集まっているので、地図を動かすより先に都道府県を選んでもらう
export default function AreaPicker({ regions, counts, total, loading, lastPrefecture, onSelect, onBrowseAll }: Props) {
  return (
    <div className="max-w-lg mx-auto px-4 py-3 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-xl text-gray-900">エリアから探す</h2>
        <div className="flex flex-wrap gap-2">
          {lastPrefecture && (
            <button
              type="button"
              onClick={() => onSelect(lastPrefecture)}
              className="h-9 px-3 rounded-full bg-blue-50 text-blue-700 text-sm font-bold inline-flex items-center gap-1.5 hover:bg-blue-100"
            >
              <History size={15} />
              前回：{lastPrefecture}
              <span className="tabular-nums font-medium opacity-80">{counts.get(lastPrefecture) ?? 0}店</span>
            </button>
          )}
          <button
            type="button"
            onClick={onBrowseAll}
            className="h-9 pl-3 pr-2 rounded-full border border-gray-200 bg-white text-sm text-gray-700 inline-flex items-center gap-1 hover:bg-gray-50"
          >
            全国すべて
            {!loading && <span className="tabular-nums text-gray-500">{total}店</span>}
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      {regions.map((region) => {
        const regionTotal = region.prefectures.reduce((sum, p) => sum + (counts.get(p) ?? 0), 0)
        return (
          <section key={region.name} className="flex flex-col gap-2">
            <h3 className="flex items-baseline justify-between text-sm font-bold text-gray-900">
              {region.name}
              {!loading && <span className="text-xs font-medium text-gray-500 tabular-nums">{regionTotal}店</span>}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {region.prefectures.map((p) => {
                const n = counts.get(p) ?? 0
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onSelect(p)}
                    disabled={!loading && n === 0}
                    aria-label={`${p}（${n}店）`}
                    className="surface h-14 px-3 flex flex-col items-start justify-center text-left hover:shadow-md transition-shadow disabled:opacity-40 disabled:hover:shadow-none"
                  >
                    <span className="text-[15px] font-bold text-gray-900 leading-tight">{shortName(p)}</span>
                    <span className="text-xs text-gray-500 tabular-nums">{loading ? '　' : `${n}店`}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
