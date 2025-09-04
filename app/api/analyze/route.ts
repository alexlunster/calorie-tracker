import { NextResponse } from "next/server";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Build a server-side Supabase client. If SUPABASE_SERVICE_ROLE_KEY is present,
 * we use it (bypasses RLS, safe on the server). Otherwise we fall back to anon
 * with request cookies so RLS still applies to the logged-in user.
 */
function makeServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const c = cookies();

  // Minimal cookies adapter for @supabase/ssr
  const cookieAdapter = {
    get(name: string) {
      return c.get(name)?.value;
    },
    set(name: string, value: string, opts?: any) {
      c.set({ name, value, ...opts });
    },
    remove(name: string, opts?: any) {
      c.set({ name, value: "", ...opts, maxAge: 0 });
    },
  };

  return createServerClient(url, (service || anon)!, {
    cookies: cookieAdapter as any,
  });
}

// --- helpers ---------------------------------------------------------------

type OutItem = { name: string; calories: number };
type Out = { meal_name: string; items: OutItem[]; total_calories: number };

/** Coerce anything (string/number/null) to a finite non-negative number (or 0) */
function n(x: any): number {
  const num = typeof x === "string" ? parseFloat(x.replace(/[^\d.-]/g, "")) : Number(x);
  if (!isFinite(num) || isNaN(num)) return 0;
  return Math.max(0, Math.round(num));
}

/** Safe string (trimmed) */
function s(x: any): string {
  if (x == null) return "";
  const str = String(x).trim();
  return str.length ? str : "";
}

/** Compute a sane Out structure from possibly-messy model JSON */
function toOut(parsed: any): Out {
  const items: OutItem[] = Array.isArray(parsed?.items)
    ? parsed.items.map((it: any) => ({
        name: s(it?.name) || "item",
        calories: n(it?.calories),
      }))
    : [];

  const sum = n(parsed?.total_calories) || items.reduce((acc, it) => acc + n(it.calories), 0);

  return {
    meal_name: s(parsed?.meal_name) || (items[0]?.name || "meal"),
    items,
    total_calories: sum,
  };
}

// --- route -----------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const { entryId, imageUrl } = await req.json();

    if (!entryId || !imageUrl) {
      return NextResponse.json(
        { error: "Missing imageUrl or entryId" },
        { status: 400 }
      );
    }

    // (Optional) quick HEAD check to surface broken public URLs early
    try {
      const head = await fetch(imageUrl, { method: "HEAD", cache: "no-store" });
      if (!head.ok) {
        return NextResponse.json(
          { error: `Image not reachable (${head.status})` },
          { status: 400 }
        );
      }
    } catch {
      /* if HEAD is blocked by host, continue */
    }

    // --- OpenAI Vision call (gpt-4o-mini) ---------------------------------
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `
You are a nutrition assistant. Look at the image of a meal and respond ONLY with JSON:
{
  "meal_name": string,        // short human name, e.g. "banana", "apple and yogurt"
  "items": [                  // 1–5 detected items
    { "name": string, "calories": number }
  ],
  "total_calories": number    // sum of item calories, integer approximate
}
- Prefer concise names in English (no brand unless obvious).
- If unsure, best effort estimate calories from portion size.
- Always include "total_calories" as an integer number of kcal.
    `.trim();

    const userText = "Analyze this meal photo and return the JSON. No extra text, no markdown.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const out = toOut(parsed);

    // --- Persist into Supabase --------------------------------------------
    const supabase = makeServerSupabase();

    // First try updating with meal_name + items + total_calories
    const attempt1 = await supabase
      .from("entries")
      .update({
        meal_name: out.meal_name,       // if column does not exist, we'll retry
        items: out.items,               // jsonb
        total_calories: out.total_calories,
      })
      .eq("id", entryId);

    if (attempt1.error) {
      // Retry without meal_name in case the column is absent in this environment
      const attempt2 = await supabase
        .from("entries")
        .update({
          items: out.items,
          total_calories: out.total_calories,
        })
        .eq("id", entryId);

      if (attempt2.error) {
        return NextResponse.json(
          { error: attempt2.error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      entryId,
      meal_name: out.meal_name,
      total_calories: out.total_calories,
      items: out.items,
    });
  } catch (err: any) {
    console.error("analyze error:", err);
    return NextResponse.json(
      { error: err?.message || "Analyze failed" },
      { status: 500 }
    );
  }
}
