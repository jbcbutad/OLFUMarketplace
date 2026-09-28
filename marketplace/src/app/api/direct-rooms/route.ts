import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { otherUserId } = await req.json();

    const { data: roomId, error: rpcError } = await supabase.rpc('get_or_create_direct_room', {
      p_other_user: otherUserId
    });

    if (rpcError) throw rpcError;

    return NextResponse.json({ roomId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}