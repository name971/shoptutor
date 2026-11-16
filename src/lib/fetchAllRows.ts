// PostgREST は1回の取得が既定で1000行までなので、集計に使う行は最後のページまで読む。
// （例：店舗の閲覧数は「日×時間帯」ごとに1行あり、60日分で最大1440行になる）
const PAGE_SIZE = 1000

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function fetchAllRows<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = []
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}
