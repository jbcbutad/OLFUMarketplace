// src/app/api/direct-messages/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Accept both 'body' and 'content' for backwards compatibility
    const { roomId, body, content, image_url } = await req.json();

    const text = String(body ?? content ?? "").trim();
    const finalBody = text || (image_url ? "Sent an image" : "");

    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }
    if (!finalBody) {
      return NextResponse.json({ error: "Message is empty" }, { status: 400 });
    }

    // Blocks are enforced by the database trigger (direct_messages_a_block_guard),
    // so they also hold if someone calls Supabase directly instead of this route.
    const { data: newMessage, error: msgError } = await supabase
      .from("direct_messages")
      .insert({
        room_id: roomId,
        sender_id: user.id,
        body: finalBody,
        image_url: image_url || null,
      })
      .select()
      .single();

    if (msgError) {
      console.error("SUPABASE DB ERROR:", msgError);
      const blocked = msgError.message?.includes("cannot send messages");
      return NextResponse.json(
        { error: msgError.message },
        { status: blocked ? 403 : 400 }
      );
    }

    return NextResponse.json(newMessage);
  } catch (e: any) {
    console.error("API CATCH ERROR:", e);
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}