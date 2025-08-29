// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs"; // use Node runtime for the OpenAI SDK
export const dynamic = "force-dynamic"; // avoid caching, always run server-side

type Item = { name: string; calories: number };
type ModelResult = {
  meal_name: string;
  items: Item[];
  total_calories: number;
};

function coerceNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeParse(content: string): ModelResult {
  try {
    const j = JSON.parse(content);

    const itemsRaw: unknown = Array.isArray(j.items) ? j.items : [];
    const items: Item[] = (itemsRaw as any[]).map((it) => ({
      name: typeof it?.name === "string" ? it.name : "item",
      calories: coerceNumber(it?.calories),
    }));

    const providedTotal = coerceNumber((j as any).total_calories);
    const computedTotal = items.reduce(
      (sum: number, it: Item) => sum + coerceNumber(it.calories),
      0
    );
    const total = providedTotal || computedTotal;

    return {
      meal_name:
        typeof (j as any).meal_name === "string" &&
        (j as any).meal_name.trim()
          ? (j as any).meal_name.trim()
          : "meal",
      items,
      total_calories: total,
    };
  } catch {
    return { meal_name: "meal", items: [], total_calories: 0 };
  }
}

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // Ask for strict JSON so we can parse reliably
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a nutrition vision assistant. Always return strict JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `From the photo, identify the food(s) and estimate calories.
Return JSON with this exact shape:
{
  "meal_name": "short name like 'banana' or 'chicken salad'",
  "items": [{"name":"banana","calories":105}],
  "total_calories": 105
}
If unsure, provide a conservative best estimate. Use kilocalories.`,
            },
            {
              type: "input_image",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    const content: string =
      completion.choices?.[0]?.message?.content ?? "{}";

    const result = safeParse(content);
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Analyze failed" },
      { status: 400 }
    );
  }
}
