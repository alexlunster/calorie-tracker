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

function safeJSON(s: string): Out {
  try {
    const o = JSON.parse(s);
    const meal = String(o.meal_name ?? o.name ?? "meal");
    const total = coerceNumber(o.total_calories ?? o.calories ?? 0);
    const itemsArr = Array.isArray(o.items) ? o.items : [];
    const items = itemsArr.map((it: any) => ({
      name: String(it?.name ?? "item"),
      calories: coerceNumber(it?.calories),
    }));
    return { meal_name: meal, total_calories: total, items };
  } catch {
    return { meal_name: "meal", total_calories: 0, items: [] };
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const entryId = String(form.get("entryId") ?? "");

    if (!file) {
      return Response.json({ ok: false, error: "no_file" }, { status: 400 });
    }

    // Read file -> data URL
    const arrayBuf = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const mime = file.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

    const prompt =
      "You are a nutrition assistant. Estimate total calories and return ONLY valid JSON with keys: meal_name (string), total_calories (number), items (array of {name, calories}).";

    // IMPORTANT: use type "image_url" (with { url }) and type "text" for text parts.
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.2,
    });

    // Some SDK versions return string; handle both string/array defensively.
    const raw = chat.choices?.[0]?.message?.content ?? "";
    const text =
      Array.isArray(raw)
        ? raw.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("\n")
        : String(raw);

    const parsed = safeJSON(text);

    // Update Supabase if entryId provided
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, key);

    if (entryId) {
      await admin
        .from("entries")
        .update({
          meal_name: parsed.meal_name,
          total_calories: parsed.total_calories,
          items: parsed.items,
        })
        .eq("id", entryId);
    }

    return Response.json({ ok: true, entryId, ...parsed });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "unknown_error" },
      { status: 500 }
    );
  }
}
