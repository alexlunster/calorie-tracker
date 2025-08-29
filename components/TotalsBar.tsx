'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { startOfDay, startOfWeek, startOfMonth } from '@/lib/aggregate';

type Entry = { created_at: string; total_calories: number; user_id: string };

export default function TotalsBar() {
  const [sumToday, setSumToday] = useState(0);
  const [sumWeek, setSumWeek] = useState(0);
  const [sumMonth, setSumMonth] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('entries')
        .select('created_at,total_calories,user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200); // read a chunk; adjust if you need more
      const entries = (data || []) as Entry[];

      const d0 = startOfDay();
      const w0 = startOfWeek();
      const m0 = startOfMonth();

      const sum = (from: Date) =>
        entries
          .filter(e => new Date(e.created_at) >= from)
          .reduce((a, b) => a + (b.total_calories || 0), 0);

      setSumToday(sum(d0));
      setSumWeek(sum(w0));
      setSumMonth(sum(m0));
    })();
  }, []);

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-2">Totals</h2>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Today" value={sumToday} />
        <Stat label="This Week" value={sumWeek} />
        <Stat label="This Month" value={sumMonth} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value} kcal</div>
    </div>
  );
}
