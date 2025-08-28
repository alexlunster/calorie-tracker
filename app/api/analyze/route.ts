import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabaseClient';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
    }

    // Send to OpenAI for food recognition & calorie estimation
    const prompt = `
You are a calorie estimation assistant.
Analyze the food in the image and return JSON with:
- items: list of foods (name + estimated calories each)
- total_calories: total calorie count.
Return only JSON.
    `;

    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Here is the meal photo.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 300,
    });

    const content = result.choices[0].message?.content;
    if (!content) throw new Error('No response from OpenAI');

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('OpenAI did not return valid JSON');
    }

    // Insert entry into Supabase (user_id is auto-set by trigger)
    const { error } = await supabase.from('entries').insert({
      image_url: imageUrl,
      items: parsed.items || [],
      total_calories: parsed.total_calories || 0,
    });

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Analyze API error:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
