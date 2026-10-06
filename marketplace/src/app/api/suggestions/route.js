// src/app/api/suggestions/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

// Same normalisation the marketplace pages use
const tagKey = (t) =>
  String(t).trim().replace(/^#+/, "").toLowerCase().replace(/[\s_,-]+/g, "");

// Internal tags that should never be suggested
const HIDDEN_TAG_KEYS = new Set(["pending", "expired", "officialmerch"]);

export async function POST(req) {
  try {
    const { query } = await req.json();
    const q = String(query || "").trim();

    if (!q) {
      return NextResponse.json({ suggestions: [] });
    }

    const needle = q.toLowerCase();
    const nowIso = new Date().toISOString();

    // Live, public, non-merch listings only
    const publicListings = (fields) =>
      supabase
        .from("products")
        .select(fields)
        .eq("is_available", true)
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    const [categoriesRes, titlesRes, tagsRes] = await Promise.all([
      // 1. Categories (Merchandise is not browsable)
      supabase
        .from("categories")
        .select("name")
        .ilike("name", `%${q}%`)
        .limit(2),

      // 2. Product titles
      publicListings("title")
        .ilike("title", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(3),

      // 3. Tags from recent public listings
      publicListings("tags")
        .not("tags", "is", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (categoriesRes.error) console.error("Suggestions (categories):", categoriesRes.error);
    if (titlesRes.error) console.error("Suggestions (titles):", titlesRes.error);
    if (tagsRes.error) console.error("Suggestions (tags):", tagsRes.error);

    const categoryMatches = (categoriesRes.data || []).map((c) => c.name);
    const titleMatches = (titlesRes.data || []).map((p) => p.title);

    const allTags = (tagsRes.data || []).flatMap((p) =>
      Array.isArray(p.tags) ? p.tags : []
    );
    const tagMatches = [...new Set(allTags)]
      .filter((tag) => !HIDDEN_TAG_KEYS.has(tagKey(tag)))
      .filter((tag) => String(tag).toLowerCase().includes(needle))
      .slice(0, 2);

    // Combine, de-duplicate, keep the dropdown short
    const suggestions = [
      ...new Set([...categoryMatches, ...titleMatches, ...tagMatches]),
    ].slice(0, 5);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Supabase Search Error:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}