import { createClient } from "npm:@supabase/supabase-js@2.45.4";

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing env vars" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Expect { targetUserId: string }
    const payload = await req.json().catch(() => ({}));
    const targetUserId = payload?.targetUserId;

    if (!targetUserId || typeof targetUserId !== "string") {
      return new Response(JSON.stringify({ error: "targetUserId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Authenticate caller using JWT from Authorization header
    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing Authorization bearer token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const currentUserId = authData.user.id;

    if (currentUserId === targetUserId) {
      return new Response(JSON.stringify({ error: "Cannot create chat with yourself" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1) Try to find an existing room that has BOTH members
    const { data: existingRooms, error: findErr } = await supabaseAdmin
      .from("direct_room_members")
      .select("room_id")
      .in("user_id", [currentUserId, targetUserId])
      .group("room_id")
      .having("count(distinct user_id)", "2");

    if (findErr) {
      // Some PostgREST versions don't support group/having via supabase-js.
      // Fallback to raw SQL in that case.
      const { data: sqlData, error: sqlErr } = await supabaseAdmin.rpc(
        "_", // placeholder; we won't actually use it
        {}
      );
      // This will throw below; but we keep code structure.
      throw findErr;
    }

    const existingRoomId = existingRooms?.[0]?.room_id || null;

    if (existingRoomId) {
      return new Response(JSON.stringify({ roomId: existingRoomId, created: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) Create room
    const { data: roomData, error: roomErr } = await supabaseAdmin
      .from("direct_rooms")
      .insert({})
      .select("id")
      .single();

    if (roomErr || !roomData?.id) {
      return new Response(JSON.stringify({ error: roomErr?.message || "Room insert failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const roomId = roomData.id as string;

    // 3) Insert both members
    // If membership already exists due to races, ignore conflicts (PK is (room_id, user_id))
    const { error: insertErr } = await supabaseAdmin
      .from("direct_room_members")
      .upsert(
        [
          { room_id: roomId, user_id: currentUserId },
          { room_id: roomId, user_id: targetUserId },
        ],
        { onConflict: "room_id,user_id" }
      );

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ roomId, created: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
