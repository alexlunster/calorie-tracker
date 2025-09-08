import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type OutItem = { name: string; calories: number };
type Out = { meal_name: string; total_calories: number; items: OutItem[] };

const clampInt = (n: unknown) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
};
const s = (x: unknown) => (typeof x === "string" ? x : String(x ?? ""));

function normalize(o: any): Out {
  const meal = s(o?.meal_name ?? o?.name ?? "meal");
  const itemsArr: any[] = Array.isArray(o?.items) ? o.items : [];
  const items: OutItem[] = itemsArr.map((it) => ({ name: s(it?.name ?? "item"), calories: clampInt(it?.calories) }));
  let total = clampInt(o?.total_calories ?? o?.calories ?? 0);
  if (total <= 0 && items.length) total = clampInt(items.reduce((sum, it) => sum + clampInt(it.calories), 0));
  return { meal_name: meal || "meal", total_calories: total, items };
}

function parseJson(text: string): Out {
  try { return normalize(JSON.parse(text)); }
  catch {
    const m = text.match(/"total_calories"\s*:\s*(\d+)/i) || text.match(/"calories"\s*:\s*(\d+)/i);
    const kcal = m ? clampInt(m[1]) : 0;
    return { meal_name: "meal", total_calories: kcal, items: [] };
  }
}

async function readImage(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const entryId = s(form.get("entryId") ?? "");
    if (!file) return { error: "no_file" } as const;
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    return { entryId, dataUrl: `data:${mime};base64,${buf.toString("base64")}` } as const;
  }

  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const src: string | undefined = (body as any)?.dataUrl || (body as any)?.image || (body as any)?.imageUrl;
    const entryId = s((body as any)?.entryId ?? "");
    if (!src) return { error: "no_file" } as const;
    return { entryId, dataUrl: src } as const;
  }

  if (ct.startsWith("image/")) {
    const blob = await req.blob();
    const arr = Buffer.from(await blob.arrayBuffer());
    return { entryId: "", dataUrl: `data:${ct};base64,${arr.toString("base64")}` } as const;
  }

  return { error: "unsupported_content_type" } as const;
}

export async function POST(req: Request) {
  try {
    const src = await readImage(req);
    if ("error" in src) return Response.json({ ok: false, error: src.error }, { status: 400 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

    const system =
      "You are a nutrition assistant. Only respond with strict JSON (no markdown, no prose). " +
      'Schema: {"meal_name": string, "total_calories": number, "items": [{"name": string, "calories": number}]}. ' +
      "Calories are integers (kcal). Do not include extra keys.";
    const userText =
      "Analyze the photo and estimate total_calories and item list. Return ONLY the JSON object per the schema.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" }, // force valid JSON
      messages: [
        { role: "system", content: system },
        { role: "user", content: [{ type: "text", text: userText }, { type: "image_url", image_url: { url: src.dataUrl } }] },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const text = Array.isArray(raw) ? raw.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("\n") : String(raw);
    const parsed = parseJson(text);

    // Update entry if provided
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, key);

    if (src.entryId) {
      await admin
        .from("entries")
        .update({
          meal_name: parsed.meal_name,
          total_calories: parsed.total_calories,
          items: parsed.items,
        })
        .eq("id", src.entryId);
    }

    return Response.json({ ok: true, entryId: src.entryId, ...parsed });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "unknown_error" }, { status: 500 });
  }
}
