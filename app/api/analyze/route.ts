// app/api/analyze/route.ts
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

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
      return Response.json({ ok: false, error: "Missing entryId or imageUrl" }, { status: 400 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return Response.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json({ ok: false, error: "Missing Supabase server env" }, { status: 500 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Lookup entry to get user_id
    const { data: entryRow, error: entryErr } = await admin.from("entries").select("id,user_id").eq("id", entryId).maybeSingle();
    if (entryErr || !entryRow?.user_id) {
      return Response.json({ ok: false, error: "Entry not found" }, { status: 404 });
    }
    const userId: string = entryRow.user_id as string;

    // Ask the model
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
            { type: "text", content: "Analyze this photo and return JSON only (no text outside JSON)." } as any,
            { type: "image_url", image_url: { url: imageUrl } } as any,
          ],
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const total = coerceNumber(parsed?.total_calories);
    const safeItems = Array.isArray(parsed?.items)
      ? parsed.items
          .slice(0, 5)
          .map((it: any) => ({ name: safeString(it?.name, "item"), calories: coerceNumber(it?.calories) }))
      : [];
    const meal_name =
      safeString(parsed?.meal_name) ||
      safeString(parsed?.title) ||
      safeString(parsed?.food) ||
      safeString(parsed?.name) ||
      "meal";

    // Update the entry row
    const { error: updErr } = await admin.from("entries").update({ meal_name, total_calories: total, items: safeItems }).eq("id", entryId);
    if (updErr) {
      return Response.json({ ok: false, error: updErr.message || "Failed to update entry" }, { status: 500 });
    }

    // STORAGE CLEANUP: keep only the last 3 images per user in 'photos' bucket
    try {
      const { data: files } = await admin.storage.from("photos").list(userId, {
        sortBy: { column: "created_at", order: "desc" },
      });
      if (files && files.length > 3) {
        const toDelete = files.slice(3).map((f: any) => `${userId}/${f.name}`);
        await admin.storage.from("photos").remove(toDelete);
      }
    } catch (e) {
      console.warn("Storage cleanup failed (non-fatal):", e);
    }

    const out: Out = { meal_name, total_calories: total, items: safeItems };
    return Response.json({ ok: true, entryId, ...out }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("/api/analyze error:", err);
    return Response.json({ ok: false, error: err?.message || "Analyze failed" }, { status: 500 });
  }
}
