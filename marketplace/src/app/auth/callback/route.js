import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const isBannedError = (code, text) =>
    code === 'user_banned' || (text || '').toLowerCase().includes('banned')

export async function GET(request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const origin = requestUrl.origin

    // Banned users come back from Supabase with error params and no code
    if (
        isBannedError(
            requestUrl.searchParams.get('error_code'),
            requestUrl.searchParams.get('error_description')
        )
    ) {
        return NextResponse.redirect(`${origin}/login?error=Banned`)
    }

    // Signup rejected by the database hook (not a val student / faculty email)
    if (
        requestUrl.searchParams.get('error') &&
        (requestUrl.searchParams.get('error_description') || '')
            .toLowerCase()
            .includes('only official olfu')
    ) {
        return NextResponse.redirect(`${origin}/login?error=UnauthorizedDomain`)
    }

    if (code) {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    get(name) {
                        return cookieStore.get(name)?.value
                    },
                    set(name, value, options) {
                        cookieStore.set({ name, value, ...options })
                    },
                    remove(name, options) {
                        cookieStore.set({ name, value: '', ...options })
                    },
                },
            }
        )

        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('OAuth callback error:', error)
            if (isBannedError(error.code, error.message)) {
                return NextResponse.redirect(`${origin}/login?error=Banned`)
            }
        } else {
            const user = data?.user

            // Domain restriction (val students + faculty/staff only)
            const email = (user?.email || '').toLowerCase()
            const allowed =
                /^[^@]+val@student\.fatima\.edu\.ph$/.test(email) ||
                /^[^@]+@fatima\.edu\.ph$/.test(email)

            if (!allowed) {
                await supabase.auth.signOut()
                return NextResponse.redirect(`${origin}/login?error=UnauthorizedDomain`)
            }

            // Safety net: the database flag is the source of truth for bans
            if (user?.id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('is_banned')
                    .eq('id', user.id)
                    .maybeSingle()

                if (profile?.is_banned) {
                    await supabase.auth.signOut()
                    return NextResponse.redirect(`${origin}/login?error=Banned`)
                }
            }

            return NextResponse.redirect(`${origin}/marketplace`)
        }
    }

    return NextResponse.redirect(`${origin}/login?error=AuthFailed`)
}