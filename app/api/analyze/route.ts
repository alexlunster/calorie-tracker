import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
    }

    const prompt = `
You are a calorie estimation assistant.
Analyze the food in the image and return JSON with:
{
  "items": [{"name":"...", "calories":123}],
  "total_calories": 456
}
Return ONLY JSON, no extra text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this meal photo.' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 400
    });

    const text = completion.choices[0]?.message?.content || '{}';

    // Be defensive with JSON
    let parsed: any = {};
    try { parsed = JSON.parse(text); }
    catch { parsed = { items: [], total_calories: 0 }; }

    return NextResponse.json({ ok: true, result: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Analyze failed' }, { status: 500 });
  }
}
