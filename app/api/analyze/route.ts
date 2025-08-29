import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// ---- tweakables ----
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024; // 8 MB safety cap
const FETCH_TIMEOUT_MS = 20000;             // 20s
// --------------------

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** robustly extract first JSON object from model text */
function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) {
    try { return JSON.parse(text.slice(s, e + 1)); } catch {}
  }
  return null;
}

/** download image and return a data URL (base64) */
async function toDataURL(imageUrl: string): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const res = await fetch(imageUrl, { signal: controller.signal });
  clearTimeout(t);

  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const reader = res.body!.getReader();

  let received = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_DOWNLOAD_BYTES) {
      throw new Error(`Image too large (> ${Math.round(MAX_DOWNLOAD_BYTES/1024/1024)}MB)`);
    }
    chunks.push(value);
  }

  const buf = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }

  // Convert to base64 data URL
  const base64 = Buffer.from(buf).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
    }

    // Turn the Supabase public URL into an inline data URL to avoid OpenAI timeouts
    const dataUrl = await toDataURL(imageUrl);

    // Strong, schema-first prompt
    const system = `
You estimate calories from a food photo.
Return STRICT JSON ONLY with this schema:

{
  "meal_name": "short human-friendly name (e.g., 'banana', 'pasta with tomato sauce')",
  "items": [
    { "name": "string", "quantity": 1, "unit": "piece|g|ml|slice|cup|tbsp|tsp|other", "calories": 123 }
  ],
  "total_calories": 123,
  "notes": "very short note about assumptions"
}

Rules:
- Output JSON ONLY (no markdown, no prose).
- Be conservative when unsure; state assumptions in "notes".
- Sum per-item calories into total_calories.
- If only one obvious food appears, use that as meal_name.
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 450,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this meal photo and return JSON only.' },
            // send the inline data URL (OpenAI does not need to fetch anything)
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content || '';
    const parsed = extractJSON(raw);

    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json(
        { ok: true, result: { meal_name: '', items: [], total_calories: 0, notes: 'Model returned unparsable output.' } },
        { status: 200 }
      );
    }

    // sanitize & normalize
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
      result: { meal_name, items: safeItems, total_calories: total, notes }
    });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Image download timed out' : (err?.message || 'Analyze failed');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
