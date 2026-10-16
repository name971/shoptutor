// タブを移動するたびに同じデータを取り直さないよう、ブラウザのメモリ上に短時間だけ保持する。
// ページを再読み込みすると消える（サーバー側では使わない）
type Entry = { value?: unknown; expires: number; promise?: Promise<unknown> }

const store = new Map<string, Entry>()

// ttlMsの間は前回の結果を返す。同時に複数から呼ばれても取得は1回にまとめる。
// fetcherが失敗（throw）した結果は保持しない
export function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && 'value' in hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T)
  if (hit?.promise) return hit.promise as Promise<T>

  const promise = fetcher()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs })
      return value
    })
    .catch((error) => {
      store.delete(key)
      throw error
    })
  store.set(key, { expires: 0, promise })
  return promise
}

// 有効期限内の保持データがあれば同期的に返す（初期表示で読み込み中を出さないため）
export function peekCached<T>(key: string): T | undefined {
  const hit = store.get(key)
  return hit && 'value' in hit && hit.expires > Date.now() ? (hit.value as T) : undefined
}

export function invalidateCached(keyPrefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key)
  }
}
