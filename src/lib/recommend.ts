import { Shop } from '@/types'

const WEIGHTS = {
  rating: 0.4,
  favorites: 0.3,
  events: 0.2,
  views: 0.1,
}

export function computeRecommendScores(
  shops: Shop[],
  favoriteCounts: Map<string, number>
): Map<string, number> {
  const shopsWithReviews = shops.filter((s) => s.review_count > 0)

  const bayesianMean =
    shopsWithReviews.length > 0
      ? shopsWithReviews.reduce((sum, s) => sum + (s.avg_total ?? 0), 0) / shopsWithReviews.length
      : 0

  const bayesianC =
    shopsWithReviews.length > 0
      ? shopsWithReviews.reduce((sum, s) => sum + s.review_count, 0) / shopsWithReviews.length
      : 0

  const maxFavorites = Math.max(1, ...shops.map((s) => Math.log(1 + (favoriteCounts.get(s.id) ?? 0))))
  const maxEvents = Math.max(1, ...shops.map((s) => Math.log(1 + s.weekly_event_count)))
  const maxViews = Math.max(1, ...shops.map((s) => Math.log(1 + s.view_count)))

  const scores = new Map<string, number>()

  shops.forEach((shop) => {
    const bayesianRating =
      shop.review_count > 0
        ? (bayesianC * bayesianMean + (shop.avg_total ?? 0) * shop.review_count) /
          (bayesianC + shop.review_count)
        : bayesianMean

    const normalizedRating = bayesianRating / 5
    const normalizedFavorites = Math.log(1 + (favoriteCounts.get(shop.id) ?? 0)) / maxFavorites
    const normalizedEvents = Math.log(1 + shop.weekly_event_count) / maxEvents
    const normalizedViews = Math.log(1 + shop.view_count) / maxViews

    const score =
      WEIGHTS.rating * normalizedRating +
      WEIGHTS.favorites * normalizedFavorites +
      WEIGHTS.events * normalizedEvents +
      WEIGHTS.views * normalizedViews

    scores.set(shop.id, score)
  })

  return scores
}
