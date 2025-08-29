'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { startOfDay, startOfWeek, startOfMonth } from '@/lib/aggregate';
import { useI18n } from '@/components/I18nProvider';

type Entry = { created_at: string; total_calories: number; user_id: string };
type Goals = { daily_target: number; weekly_target: number; monthly_target: number };

export default function TotalsBar() {
  const { t } = useI18n();
  const [sumToday, setSumToday] = useState(0);
  const [sumWeek, setSumWeek] = useState(0);
  const [sumMonth, setSumMonth] = useState(0);
  const [goals, setGoals] = useState<Goals>({ daily_target: 2000, weekly_target: 14000, monthly_target: 60000 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: entries }, { data: g }] = await Promise.all([
        supabase.from('entries')
          .select('created_at,total_calories,user_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('goals').select('*').eq('user_id', user.id).single()
      ]);

      if (g) setGoals(g as Goals);

      const list = (entries || []) as Entry[];
      const d0 = startOfDay(); const w0 = startOfWeek(); const m0 = startOfMonth();
      const sum = (from: Date) => list.filter(e => new Date(e.created_at) >= from)
        .reduce((a, b) => a + (b.total_calories || 0), 0);

      setSumToday(sum(d0));
      setSumWeek(sum(w0));
      setSumMonth(sum(m0));
    })();
  }, []);

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-2">{t('totals')}</h2>
      <div className="grid grid-cols-3 gap-4">
        <Stat label={t('today')} value={sumToday} target={goals.daily_target} tKcal={t('kcal')} tOf={t('of')} />
        <Stat label={t('this_week')} value={sumWeek} target={goals.weekly_target} tKcal={t('kcal')} tOf={t('of')} />
        <Stat label={t('this_month')} value={sumMonth} target={goals.monthly_target} tKcal={t('kcal')} tOf={t('of')} />
      </div>
    </div>
  );
}

function Stat({
  label, value, target, tKcal, tOf,
}: { label: string; value: number; target: number; tKcal: string; tOf: string }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value} {tKcal}</div>
      <div className="text-xs text-gray-500">{pct}% {tOf} {target} {tKcal}</div>
      <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
        <div className="h-2 bg-black rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
