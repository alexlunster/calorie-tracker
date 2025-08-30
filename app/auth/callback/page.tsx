"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session) {
        // already logged in
        router.replace("/");
      } else {
        // try to recover session from URL
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (!error) router.replace("/");
      }
    }
    handleCallback();
  }, [router]);

  return <p>Finishing login…</p>;
}
