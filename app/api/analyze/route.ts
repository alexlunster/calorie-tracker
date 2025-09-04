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

function safeJSON(s: string): Out {
  try {
    const o = JSON.parse(s);
    const meal = String(o.meal_name || o.name || "meal");
    const total = coerceNumber(o.total_calories ?? o.calories ?? 0);
    const itemsArr = Array.isArray(o.items) ? o.items : [];
    const items = itemsArr.map((it: any) => ({
      name: String(it.name || "item"),
      calories: coerceNumber(it.calories),
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
    const entryId = String(form.get("entryId") || "");
    if (!file) {
      return Response.json({ ok: false, error: "no_file" }, { status: 400 });
    }

    // Read file into base64
    const arrayBuf = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const mime = file.type || "image/jpeg";
    const image_url = `data:${mime};base64,${base64}`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

    const prompt = String(
      "You are a nutrition assistant. Estimate total calories and list items as JSON with keys: meal_name, total_calories, items[].items[].name, items[].calories. Respond with only JSON."
    );

    // The error you saw happens when 'text' is not a string.
    // We force the text parts to be strings.
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "input_image", image_url }
          ],
        },
      ],
      temperature: 0.2,
    });

    const raw = chat.choices?.[0]?.message?.content || "";
    const text = Array.isArray(raw)
      ? raw.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("\n")
      : String(raw);

    const parsed = safeJSON(text);

    // Update Supabase entry if provided
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
    return Response.json({ ok: false, error: e?.message || "unknown_error" }, { status: 500 });
  }
}
