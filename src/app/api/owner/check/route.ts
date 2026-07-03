import { NextResponse } from 'next/server'
import { requireShopOwner } from '@/lib/owner-auth'

export async function GET() {
  const result = await requireShopOwner()
  if (!result) return NextResponse.json({ isOwner: false })

  return NextResponse.json({ isOwner: true, shop: result.shop })
}
