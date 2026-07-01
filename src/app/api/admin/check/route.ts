import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const user = await requireAdmin()
  return NextResponse.json({ isAdmin: !!user })
}
