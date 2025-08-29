import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extracts the first JSON object from a string.
 * Handles cases where the model returns prose around a JSON block.
 */
function extractJSON(text: string): any {
  // Try a simple parse first
  try { return JSON.parse(text); } catch {}

  // Fallback: find the first { ... } block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch {}
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
    }

    // Clear, schema-first prompt. (Model: gpt-4o-mini supports vision.)
    const system = `
You estimate calories from a food photo.
Return STRICT JSON ONLY matching this schema:

{
  "meal_name": "short human-friendly name (e.g., 'banana', 'pasta with tomato sauce')",
  "items": [
    { "name": "string", "quantity": 1, "unit": "piece|g|ml|slice|cup|tbsp|tsp|other", "calories": 123 }
  ],
  "total_calories": 123,
  "notes": "very short note about assumptions"
}

Rules:
- Never include markdown, backticks, or prose outside the JSON.
- If uncertain, be conservative and state assumptions in "notes".
- Sum per-item calories into total_calories.
- If only one obvious food appears, use that as meal_name.
    `.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this meal photo and return JSON only.' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 450
    });

    const raw = completion.choices?.[0]?.message?.content || '';
    const parsed = extractJSON(raw);

    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json(
        { ok: true, result: { meal_name: '', items: [], total_calories: 0, notes: 'Model returned unparsable output.' } },
        { status: 200 }
      );
    }

    // Sanitize result
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const safeItems = items
      .map((i: any) => ({
        name: String(i?.name || '').slice(0, 80),
        quantity: Number.isFinite(+i?.quantity) ? +i.quantity : 1,
        unit: String(i?.unit || '').slice(0, 20),
        calories: Number.isFinite(+i?.calories) ? Math.max(0, Math.round(+i.calories)) : 0
      }))
      .filter((i: any) => i.name);

    const totalFromItems = safeItems.reduce((a: number, b: any) => a + (b.calories || 0), 0);
    const total = Number.isFinite(+parsed.total_calories)
      ? Math.max(0, Math.round(+parsed.total_calories))
      : totalFromItems;

    const meal_name = String(parsed.meal_name || (safeItems[0]?.name ?? '')).slice(0, 80);
    const notes = String(parsed.notes || '').slice(0, 240);

    return NextResponse.json({
      ok: true,
      result: {
        meal_name,
        items: safeItems,
        total_calories: total,
        notes
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Analyze failed' }, { status: 500 });
  }
}
