// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

function getClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Prevent "Multiple GoTrueClient instances" warnings during Next.js Hot Module Replacement (HMR)
const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof getClient> | undefined;
};

export const supabase = globalForSupabase.supabase ?? getClient();

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabase = supabase;
}