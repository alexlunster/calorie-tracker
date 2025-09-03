import OpenAI from "openai";

export const runtime = "nodejs"; // avoid Edge memory/timeouts

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type Out = {
  meal_name: string | null;
  items: { name: string; calories: number }[];
  total_calories: number | null;
};

export async function POST(req: Request) {
  try {
    const { imageUrl } = (await req.json()) as { imageUrl?: string };
    if (!imageUrl) {
      return Response.json({ error: "missing imageUrl" }, { status: 400 });
    }

    // 1) Download with retries (bypass any HTML viewer with ?download)
    const dlUrl = addCacheBuster(addDownload(imageUrl));
    const imgBytes = await getBytesWithRetry(dlUrl, 5, 800);
    const b64 = Buffer.from(imgBytes).toString("base64");
    const dataUrl = `data:image/jpeg;base64,${b64}`;

    // 2) Ask GPT-4o Mini Vision with strict JSON
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a nutrition assistant. From the food photo, infer a short meal name and a list of items with estimated calories. Return ONLY JSON with this shape: {\"meal_name\": string, \"items\":[{\"name\":string,\"calories\":number}], \"total_calories\": number}. Numbers should be in kcal.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Identify the food(s) and estimate calories. Be concise but accurate. Fill the JSON fields. If unsure, still return your best numeric estimate.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "low" },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed: Partial<Out>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const out: Out = {
      meal_name: safeString(parsed.meal_name),
      items: Array.isArray(parsed.items)
        ? parsed.items
            .map((it: any) => ({
              name: safeString(it?.name) ?? "item",
              calories: toNumber(it?.calories),
            }))
            .filter((it) => isFinite(it.calories))
        : [],
      total_calories: toNumber(parsed.total_calories),
    };

    // If model forgot total_calories, derive from items
    if (!isFiniteNum(out.total_calories) && out.items.length) {
      out.total_calories = Math.round(
        out.items.reduce((s, it) => s + (isFiniteNum(it.calories) ? it.calories : 0), 0)
      );
    }
    if (!isFiniteNum(out.total_calories)) out.total_calories = 0;

    // Minimal meal_name fallback
    if (!out.meal_name || out.meal_name.trim() === "") {
      out.meal_name = out.items.length ? out.items[0].name : "meal";
    }

    return Response.json(out);
  } catch (err: any) {
    const msg = String(err?.message || err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ---- helpers ----

function addDownload(url: string) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("download")) u.searchParams.set("download", "");
    return u.toString();
  } catch {
    return url;
  }
}
function addCacheBuster(url: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("_", Date.now().toString());
    return u.toString();
  } catch {
    return url;
  }
}

async function getBytesWithRetry(
  url: string,
  tries = 5,
  baseDelayMs = 800
): Promise<ArrayBuffer> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20_000); // 20s per try
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "image/*" },
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      return await res.arrayBuffer();
    } catch (e) {
      lastErr = e;
      await sleep(baseDelayMs * Math.pow(1.6, i));
    }
  }
  throw lastErr || new Error("download failed");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function safeString(v: any): string | null {
  if (typeof v === "string") return v;
  return null;
}
function toNumber(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}
function isFiniteNum(n: any): n is number {
  return typeof n === "number" && isFinite(n);
}
