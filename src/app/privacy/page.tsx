import Link from 'next/link'
import BackButton from '@/components/ui/BackButton'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <BackButton />
        <div className="font-bold text-sm">プライバシーポリシー</div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border p-4 flex flex-col gap-5 text-sm leading-relaxed text-gray-700">
          <p>
            ShopTutor（以下「本サービス」）は、ユーザーの個人情報を以下の方針に基づいて取り扱います。
          </p>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第1条（取得する情報）</h2>
            <p>本サービスは、ユーザーのご利用にあたり、以下の情報を取得します。</p>
            <ul className="list-disc pl-5 mt-1">
              <li>Google又はXアカウントでのログイン時に提供される、氏名（表示名）・メールアドレス・プロフィール画像等</li>
              <li>ユーザーが登録するよく遊ぶフォーマット等のプロフィール情報</li>
              <li>ユーザーが投稿するレビュー・評価・写真等のコンテンツ</li>
              <li>お気に入り登録・いいね等の操作履歴</li>
              <li>本サービスの利用状況に関するアクセスログ</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第2条（利用目的）</h2>
            <p>取得した情報は、以下の目的で利用します。</p>
            <ul className="list-disc pl-5 mt-1">
              <li>本サービスの提供・維持・改善のため</li>
              <li>ユーザー認証、不正利用の防止のため</li>
              <li>ユーザーからのお問い合わせに対応するため</li>
              <li>利用規約に違反する行為への対応のため</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第3条（第三者提供）</h2>
            <p>
              運営者は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
              ただし、特定の個人を識別できない形に加工した統計情報（例: フォーマット別の閲覧・お気に入り傾向等）については、
              提携店舗等の第三者に提供することがあります。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第4条（外部サービスの利用）</h2>
            <p>
              本サービスは、認証及びデータ保管にSupabase社のサービスを利用しています。
              取得した情報は、これらの外部サービスのサーバーに保管される場合があります。
              各社のプライバシーポリシーについては、それぞれの公式サイトをご確認ください。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第5条（Cookie等の利用）</h2>
            <p>
              本サービスは、ログイン状態の維持や表示設定の保存のため、Cookie・ローカルストレージ等の技術を利用します。
              これらは広告配信等の目的では利用しません。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第6条（情報の開示・訂正・削除）</h2>
            <p>
              ユーザーは、マイページから自身のプロフィール情報・投稿コンテンツをいつでも確認・編集・削除できます。
              アカウントの削除を行った場合、レビュー・お気に入り・写真等のデータは完全に削除され、復元することはできません。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第7条（プライバシーポリシーの変更）</h2>
            <p>
              運営者は、必要と判断した場合には、ユーザーへの通知をもって、本ポリシーの内容を変更できるものとします。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第8条（お問い合わせ）</h2>
            <p>
              本ポリシーに関するお問い合わせは、本サービスの
              <Link href="/terms" className="text-blue-600 hover:underline">利用規約</Link>
              に定める方法によりご連絡ください。
            </p>
          </section>

          <p className="text-xs text-gray-400 pt-2 border-t">制定日: 2026年7月2日</p>
        </div>
      </div>
    </div>
  )
}
