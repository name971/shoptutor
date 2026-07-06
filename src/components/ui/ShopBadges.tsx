type Props = {
  shop: {
    first_listed_at: string
    is_wpn_premium: boolean
    is_teaching_meister: boolean
  }
  size?: 'sm' | 'md'
  showNew?: boolean
  showWpn?: boolean
  showMeister?: boolean
}

export function isNew(firstListedAt: string): boolean {
  const listed = new Date(firstListedAt)
  const now = new Date()
  const diffDays = (now.getTime() - listed.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays <= 30
}

export default function ShopBadges({ shop, size = 'md', showNew = true, showWpn = true, showMeister = true }: Props) {
  const sizeClass = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'

  return (
    <div className="flex flex-wrap gap-1">
      {showNew && isNew(shop.first_listed_at) && (
        <span className={`inline-flex items-center rounded-full font-medium bg-indigo-100 text-indigo-800 ${sizeClass}`}>
          NEW
        </span>
      )}
      {showWpn && shop.is_wpn_premium && (
        <span className={`inline-flex items-center rounded-full font-medium bg-yellow-100 text-yellow-800 ${sizeClass}`}>
          WPNプレミアム
        </span>
      )}
      {showMeister && shop.is_teaching_meister && (
        <span className={`inline-flex items-center rounded-full font-medium bg-orange-100 text-orange-800 ${sizeClass}`}>
          マイスター
        </span>
      )}
    </div>
  )
}