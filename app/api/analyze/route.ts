import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });

    const prompt = `You are a nutrition estimator. Look at the image and return a concise JSON with:
{
  "items":[{"name": "...", "quantity": 1, "unit":"...", "calories": 123}], 
  "total_calories": 1234,
  "notes": "short notes about assumptions"
}
Return JSON only, no markdown.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Image of a meal for calorie analysis." },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      temperature: 0.1
    });

    const text = completion.choices[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = { items: [], total_calories: 0 }; }

    return NextResponse.json({ ok: true, result: parsed });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
