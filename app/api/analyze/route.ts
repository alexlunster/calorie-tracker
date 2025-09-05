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

async function readImageFromRequest(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  // 1) Multipart / urlencoded -> use formData
  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const entryId = String(form.get("entryId") ?? "");
    if (!file) return { error: "no_file" } as const;
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    return { entryId, dataUrl } as const;
  }

  // 2) JSON -> expect { image | imageUrl | dataUrl, entryId }
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const src: string | undefined = body?.dataUrl || body?.image || body?.imageUrl;
    const entryId = String(body?.entryId ?? "");
    if (!src) return { error: "no_file" } as const;
    return { entryId, dataUrl: src } as const;
  }

  // 3) Raw image (image/*)
  if (ct.startsWith("image/")) {
    const blob = await req.blob();
    const arr = Buffer.from(await blob.arrayBuffer());
    const dataUrl = `data:${ct};base64,${arr.toString("base64")}`;
    return { entryId: "", dataUrl } as const;
  }

  return { error: "unsupported_content_type" } as const;
}

export async function POST(req: Request) {
  try {
    const src = await readImageFromRequest(req);
    if ("error" in src) {
      return Response.json(
        { ok: false, error: src.error },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

    const prompt =
      "You are a nutrition assistant. Estimate total calories and return ONLY valid JSON with keys: meal_name (string), total_calories (number), items (array of {name, calories}).";

    // Correct vision shape: "image_url" with { url }
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: src.dataUrl } },
          ],
        },
      ],
      temperature: 0.2,
    });

    const raw = chat.choices?.[0]?.message?.content ?? "";
    const text = Array.isArray(raw)
      ? raw.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("\n")
      : String(raw);

    const parsed = safeJSON(text);

    // Update the entry if provided
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
    return Response.json(
      { ok: false, error: e?.message || "unknown_error" },
      { status: 500 }
    );
  }
}
