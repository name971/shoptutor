// 店舗詳細ページのキャッシュを捨てて、書いた内容（レビュー・写真・いいね）をすぐ反映させる。
// 失敗しても1時間以内には作り直されるので、画面の操作は止めない
export async function revalidateShop(shopId: string): Promise<void> {
  try {
    await fetch(`/api/shops/${shopId}/revalidate`, { method: 'POST' })
  } catch {
    // 通信に失敗しても何もしない
  }
}
