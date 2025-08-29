// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs"; // ensure Node (not Edge) so the SDK works

type ModelResult = {
  meal_name: string;
  items: { name: string; calories: number }[];
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
    const itemsRaw = Array.isArray(j.items) ? j.items : [];
    const items = itemsRaw
      .map((it: any) => ({
        name: typeof it?.name === "string" ? it.name : "item",
        calories: coerceNumber(it?.calories),
      }))
      .filter(Boolean);

    const total =
      coerceNumber(j.total_calories) ||
      items.reduce((s, it) => s + coerceNumber(it.calories), 0);

    return {
      meal_name:
        typeof j.meal_name === "string" && j.meal_name.trim()
          ? j.meal_name.trim()
          : "meal",
      items,
      total_calories: total,
    };
  } catch {
    // Fallback minimal structure
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

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // Ask for strict JSON; the SDK returns content as a string
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
  "meal_name": "short human-readable name (e.g. 'banana', 'chicken salad')",
  "items": [{"name": "banana", "calories": 105}],
  "total_calories": 105
}
If unsure, give your best conservative estimate. Use kilocalories.`,
            },
            {
              type: "input_image",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "{}";
    const result = safeParse(content);

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Analyze failed" },
      { status: 400 }
    );
  }
}
