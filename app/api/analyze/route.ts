// app/api/analyze/route.ts
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Force Node runtime (not edge), because we need server env & OpenAI SDK.
export const runtime = "nodejs";

type OutItem = { name: string; calories: number };
type Out = { meal_name: string; total_calories: number; items: OutItem[] };

function coerceNumber(x: unknown): number {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function safeString(x: unknown, fallback = ""): string {
  if (typeof x === "string") return x.trim();
  return fallback;
}

export async function POST(req: Request) {
  try {
    const { entryId, imageUrl } = (await req.json()) as {
      entryId?: string;
      imageUrl?: string;
    };

    if (!entryId || !imageUrl) {
      return Response.json(
        { ok: false, error: "Missing entryId or imageUrl" },
        { status: 400 }
      );
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return Response.json(
        { ok: false, error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return Response.json(
        { ok: false, error: "Missing Supabase env (URL or SERVICE KEY)" },
        { status: 500 }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Ask the model for strict JSON only.
    const systemPrompt = [
      "You are a nutrition assistant.",
      "Given a food photo, extract a single overall meal name (short and clear),",
      "estimate total calories (integer), and list up to 5 main detected items with their calories (integers).",
      "Always return strict JSON with this exact shape:",
      `{
        "meal_name": "banana with yogurt",
        "total_calories": 320,
        "items": [
          {"name": "banana", "calories": 90},
          {"name": "yogurt", "calories": 230}
        ]
      }`,
      "No extra keys. No commentary. Numbers only for calories.",
    ].join(" ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this photo and return JSON only (no text outside JSON).",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    // Sanitize output
    const items: OutItem[] = Array.isArray(parsed?.items)
      ? parsed.items.map((it: any) => ({
          name: safeString(it?.name, "item"),
          calories: coerceNumber(it?.calories),
        }))
      : [];

    let total = coerceNumber(parsed?.total_calories);
    const sum = items.reduce((s, it) => s + coerceNumber(it.calories), 0);

    // Prefer the sum if model's total is missing/way off
    if (sum > 0 && (total === 0 || Math.abs(total - sum) > 10)) {
      total = sum;
    }

    const meal_name =
      safeString(parsed?.meal_name) ||
      safeString(parsed?.food) ||
      safeString(parsed?.name) ||
      "meal";

    // Update the entry row with results (service role bypasses RLS)
    const { error: updErr } = await admin
      .from("entries")
      .update({
        meal_name,
        total_calories: total,
        items,
      })
      .eq("id", entryId);

    if (updErr) {
      return Response.json(
        { ok: false, error: `DB update failed: ${updErr.message}` },
        { status: 500 }
      );
    }

    const out: Out = { meal_name, total_calories: total, items };
    return Response.json(
      { ok: true, entryId, ...out },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("/api/analyze error:", err);
    return Response.json(
      { ok: false, error: err?.message || "Analyze failed" },
      { status: 500 }
    );
  }
}
