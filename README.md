# Calorie Tracker (Next.js + Supabase + OpenAI)
Created: 2025-08-28T13:07:09.415574Z

## Deploy on Vercel
1) Create a project on Vercel and import this folder (GitHub or drag & drop).
2) Add Environment Variables (Settings → Environment Variables):
   - NEXT_PUBLIC_SUPABASE_URL = your Supabase project URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = anon public key
   - OPENAI_API_KEY = your OpenAI key
3) Deploy (or Redeploy if you added env vars later).

Supabase needs tables, RLS and a storage bucket `photos` (you already set these up earlier).
