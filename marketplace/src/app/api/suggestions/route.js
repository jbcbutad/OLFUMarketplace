import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function POST(req) {
  try {
    const { query } = await req.json();

    if (!query || query.trim() === "") {
      return NextResponse.json({ suggestions: [] });
    }

    const searchTerm = query.toLowerCase();

    // 1. Search the CATEGORIES table
    const { data: categoriesData, error: catError } = await supabase
      .from("categories")
      .select("name")
      .ilike("name", `%${query}%`) 
      .limit(2); // Keep limit small so it doesn't flood the UI

    const categoryMatches = categoriesData ? categoriesData.map(c => c.name) : [];

    // 2. Search Product TITLES (Highly recommended!)
    const { data: titleData, error: titleError } = await supabase
      .from("products")
      .select("title")
      .ilike("title", `%${query}%`)
      .limit(3);

    const titleMatches = titleData ? titleData.map(p => p.title) : [];

    // 3. Search Product TAGS
    const { data: productsData, error: prodError } = await supabase
      .from("products")
      .select("tags")
      .not("tags", "is", null) 
      .limit(100); 

    let tagMatches = [];
    if (productsData) {
      // Safely ensure tags is an array before flattening
      const allTags = productsData.flatMap(p => Array.isArray(p.tags) ? p.tags : []);
      const uniqueTags = [...new Set(allTags)];
      
      tagMatches = uniqueTags
        .filter(tag => tag.toLowerCase().includes(searchTerm))
        .slice(0, 2); 
    }

    // 4. Combine everything and remove duplicates
    // We slice to 5 at the end so the dropdown doesn't get ridiculously long
    const combinedSuggestions = [
      ...new Set([...categoryMatches, ...titleMatches, ...tagMatches])
    ].slice(0, 5);

    return NextResponse.json({ suggestions: combinedSuggestions });

  } catch (error) {
    console.error("Supabase Search Error:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}