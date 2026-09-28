import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Accept both 'body' and 'content' for flawless backwards compatibility
    const { roomId, body, content, image_url } = await req.json();

    // 2. Resolve final text string to save into the database
    const finalBody = body || content || (image_url ? "Sent an image" : "");

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    // 3. Insert message cleanly into the database schema
    const { data: newMessage, error: msgError } = await supabase
      .from("direct_messages")
      .insert({
        room_id: roomId,
        sender_id: user.id,
        body: finalBody,
        image_url: image_url || null   
      })
      .select()
      .single(); 

    if (msgError) {
      console.error("SUPABASE DB ERROR:", msgError);
      return NextResponse.json({ error: msgError.message }, { status: 400 });
    }

    return NextResponse.json(newMessage);
  } catch (e: any) {
    console.error("API CATCH ERROR:", e);
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}