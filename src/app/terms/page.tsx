import Link from 'next/link'
import BackButton from '@/components/ui/BackButton'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <BackButton />
        <div className="font-bold text-sm">利用規約</div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border p-4 flex flex-col gap-5 text-sm leading-relaxed text-gray-700">
          <p>
            この利用規約（以下「本規約」）は、ShopTutor（以下「本サービス」）の利用条件を定めるものです。
            利用者の皆様（以下「ユーザー」）には、本規約に従って本サービスをご利用いただきます。
          </p>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第1条（適用）</h2>
            <p>
              本規約は、ユーザーと本サービス運営者との間の本サービスの利用に関わる一切の関係に適用されるものとします。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第2条（利用登録）</h2>
            <p>
              本サービスの一部機能は、Google又はXアカウントによる認証を経て利用登録を行うことで利用できます。
              運営者は、登録希望者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあります。
            </p>
            <ul className="list-disc pl-5 mt-1">
              <li>虚偽の情報を届け出た場合</li>
              <li>本規約に違反したことがある者からの申請である場合</li>
              <li>その他、運営者が利用登録を相当でないと判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第3条（禁止事項）</h2>
            <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
            <ul className="list-disc pl-5 mt-1">
              <li>法令又は公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>事実に反する内容、誹謗中傷、又は第三者の権利を侵害する内容を投稿する行為</li>
              <li>他のユーザーに関する個人情報等を収集又は蓄積する行為</li>
              <li>本サービスのネットワーク又はシステム等に過度な負荷をかける行為</li>
              <li>本サービスの運営を妨害するおそれのある行為</li>
              <li>不正アクセスをし、又はこれを試みる行為</li>
              <li>他のユーザーになりすます行為</li>
              <li>本サービスに関連して、反社会的勢力に対して直接又は間接に利益を供与する行為</li>
              <li>その他、運営者が不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第4条（投稿コンテンツの取り扱い）</h2>
            <p>
              ユーザーが本サービスに投稿したレビュー・写真等のコンテンツ（以下「投稿コンテンツ」）の著作権は、
              投稿を行ったユーザーに帰属します。ただし、ユーザーは運営者に対し、本サービスの提供・改善・宣伝等の目的で、
              投稿コンテンツを無償で利用（複製、公衆送信、翻案等を含みます）する権利を許諾するものとします。
            </p>
            <p className="mt-1">
              運営者は、投稿コンテンツが第3条に違反すると判断した場合、事前の通知なく当該投稿コンテンツを削除又は非表示にすることができるものとします。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第5条（本サービスの提供の停止等）</h2>
            <p>
              運営者は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部又は一部の提供を停止又は中断することができるものとします。
            </p>
            <ul className="list-disc pl-5 mt-1">
              <li>本サービスにかかるシステムの保守点検又は更新を行う場合</li>
              <li>地震、落雷、火災、停電又は天災などの不可抗力により、本サービスの提供が困難となった場合</li>
              <li>コンピュータ又は通信回線等が事故により停止した場合</li>
              <li>その他、運営者が本サービスの提供が困難と判断した場合</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第6条（掲載情報に関する免責事項）</h2>
            <p>
              運営者は、本サービスに掲載する店舗情報・イベント情報について、その正確性・最新性・完全性を保証するものではありません。
              実際の開催状況・在庫状況等については、必ず各店舗の公式情報をご確認ください。
            </p>
            <p className="mt-1">
              また、ユーザーが投稿したレビュー等のコンテンツについても、その内容の正確性・信頼性等について運営者は保証しません。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第7条（免責事項）</h2>
            <p>
              運営者は、本サービスに関して、ユーザーと他のユーザー又は第三者との間において生じた取引、連絡又は紛争等について一切責任を負いません。
              運営者は、本サービスに起因してユーザーに生じたあらゆる損害について、運営者の故意又は重過失による場合を除き、一切の責任を負わないものとします。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第8条（サービス内容の変更等）</h2>
            <p>
              運営者は、ユーザーへの事前の告知なしに、本サービスの内容を変更、追加又は廃止することがあり、ユーザーはこれを承諾するものとします。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第9条（利用規約の変更）</h2>
            <p>
              運営者は、必要と判断した場合には、ユーザーへの通知をもって、本規約を変更できるものとします。
              本規約の変更後、本サービスの利用を継続した場合には、変更後の規約に同意したものとみなします。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第10条（個人情報の取扱い）</h2>
            <p>
              運営者は、本サービスの利用によって取得する個人情報については、
              <Link href="/privacy" className="text-blue-600 hover:underline">プライバシーポリシー</Link>
              に従い適切に取り扱うものとします。
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-1">第11条（準拠法・裁判管轄）</h2>
            <p>
              本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、
              運営者の所在地を管轄する裁判所を専属的合意管轄とします。
            </p>
          </section>

          <p className="text-xs text-gray-400 pt-2 border-t">制定日: 2026年7月2日</p>
        </div>
      </div>
    </div>
  )
}
