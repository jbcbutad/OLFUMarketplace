import { type NextRequest } from "next/server";
import { proxy } from "./lib/supabase/proxy";

export async function middleware(request: NextRequest) {
  return await proxy(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};