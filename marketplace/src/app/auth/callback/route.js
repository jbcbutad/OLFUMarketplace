import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const origin = requestUrl.origin

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

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            const { data: { user } } = await supabase.auth.getUser()

            if (user?.email) {
                const email = user.email.toLowerCase()
                const isStudent = email.endsWith('@student.fatima.edu.ph')
                const isFaculty = email.endsWith('@fatima.edu.ph')

                // Domain restriction check for institutional emails
                if (!isStudent && !isFaculty) {
                    await supabase.auth.signOut()
                    return NextResponse.redirect(`${origin}/login?error=UnauthorizedDomain`)
                }
            }

            return NextResponse.redirect(`${origin}/`)
        }
    }

    return NextResponse.redirect(`${origin}/login?error=AuthFailed`)
}