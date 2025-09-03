import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ---- Types ----
type Item = { name: string; calories: number };
type Out = {
  meal_name: string;
  items: Item[];
  total_calories: number;
};

// ---- Helpers ----
function coerceNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function safeString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim().length ? v.trim() : fallback;
}

function toItems(arr: unknown): Item[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((raw: any): Item => {
    const name = safeString(raw?.name, "item");
    const calories = coerceNumber(raw?.calories);
    return { name, calories };
  });
}

function toOut(parsed: any): Out {
  const meal_name = safeString(parsed?.meal_name, "");
  const items = toItems(parsed?.items);
  const fromModel = coerceNumber(parsed?.total_calories);
  const fromItems = items.reduce((s, it) => s + coerceNumber(it.calories), 0);
  const total_calories = fromModel || fromItems || 0;
  return { meal_name, items, total_calories };
}

// ---- OpenAI client ----
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ---- Supabase (service role not required; anon key fine for server) ----
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---- Route ----
export async function POST(req: Request) {
  try {
    const { imageUrl, entryId } = await req.json();

    if (!imageUrl || !entryId) {
      return NextResponse.json(
        { error: "Missing imageUrl or entryId" },
        { status: 400 }
      );
    }

    // Ask the model for strictly-typed JSON
    const sysPrompt = `
You are a nutrition assistant. Given a single food photo, return JSON with:
{
  "meal_name": string,        // short human label e.g. "banana", "chicken salad"
  "items": [                  // each recognized item with estimated calories
    { "name": string, "calories": number }
  ],
  "total_calories": number    // total kcal for the whole photo
}
If unsure, make your best reasonable estimate. Numbers must be plain numbers, not strings.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sysPrompt },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Analyze this photo and return the JSON." },
            { type: "input_image", image_url: imageUrl },
          ] as any, // OpenAI SDK types differ between versions; keep as any for safety
        },
      ],
    });

    const raw =
      completion.choices?.[0]?.message?.content?.trim() ||
      '{"meal_name":"","items":[],"total_calories":0}';

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If the model somehow didn't return perfect JSON, fall back to zeros
      parsed = { meal_name: "", items: [], total_calories: 0 };
    }

    const out = toOut(parsed); // <- ensures correct, non-null numbers

    // Update the entry row with results
    const { error: upErr } = await supabase
      .from("entries")
      .update({
        meal_name: out.meal_name,
        items: out.items, // jsonb
        total_calories: out.total_calories,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entryId)
      .select("id")
      .single();

    if (upErr) {
      return NextResponse.json(
        { error: "Failed to update entry", details: upErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, result: out });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Analyze failed",
        details: e?.message || String(e),
      },
      { status: 500 }
    );
  }
}
