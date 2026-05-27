import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const ADMIN_ONLY = ['/accounts', '/audit']
const PUBLIC = ['/login']
const PUBLIC_NO_REDIRECT = ['/progreso']
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    if (session) return NextResponse.redirect(new URL('/dashboard', req.url))
    return NextResponse.next()
  }

  if (PUBLIC_NO_REDIRECT.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const idleTimeoutMs = (session.user as Record<string, unknown>)?.idleTimeoutMs as number | undefined

  if (idleTimeoutMs) {
    const lastActivity = req.cookies.get('last_activity')?.value
    const now = Date.now()
    if (lastActivity && now - parseInt(lastActivity) > idleTimeoutMs) {
      const response = NextResponse.redirect(new URL('/login', req.url))
      response.cookies.delete('last_activity')
      SESSION_COOKIES.forEach((name) => response.cookies.delete(name))
      return response
    }
  }

  const role = (session.user as Record<string, unknown>)?.role as string | undefined
  if (ADMIN_ONLY.some((p) => pathname.startsWith(p)) && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const response = NextResponse.next()
  if (idleTimeoutMs) {
    response.cookies.set('last_activity', Date.now().toString(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.ceil(idleTimeoutMs / 1000),
    })
  }
  return response
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
