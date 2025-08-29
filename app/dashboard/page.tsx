'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { startOfDay, startOfWeek, startOfMonth } from '@/lib/aggregate';

type Entry = {
  id: string;
  total_calories: number;
  created_at: string;
  items: any;
  image_url: string;
};

type Goals = { daily_target: number; weekly_target: number; monthly_target: number; };

export default function Dashboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [goals, setGoals] = useState<Goals>({ daily_target: 2000, weekly_target: 14000, monthly_target: 60000 });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: e } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setEntries(e || []);
    const { data: g } = await supabase.from('goals').select('*').eq('user_id', user.id).single();
    if (g) setGoals(g as Goals);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const today = startOfDay();
  const week = startOfWeek();
  const month = startOfMonth();

  const sum = (from: Date) =>
    entries.filter(x => new Date(x.created_at) >= from)
           .reduce((a, b) => a + (b.total_calories || 0), 0);

  function labelFromItems(items: any): string {
    // Prefer a meal_name inside items if the API returned it (stored alongside items),
    // else fallback to first item's name or empty.
    if (items && typeof items === 'object' && items.meal_name) return String(items.meal_name);
    if (Array.isArray(items) && items.length) return String(items[0]?.name || '');
    return '';
  }

  async function saveGoals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('goals').upsert({ user_id: user.id, ...goals });
    alert('Saved!');
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return;
    const { error } = await supabase.from('entries').delete().eq('id', id);
    if (error) {
      alert('Delete failed: ' + error.message);
      return;
    }
    // reload list
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div className="grid gap-4">
      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Totals</h2>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Today" value={sum(today)} target={goals.daily_target} />
          <Stat label="This Week" value={sum(week)} target={goals.weekly_target} />
          <Stat label="This Month" value={sum(month)} target={goals.monthly_target} />
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Goals</h2>
        <div className="grid grid-cols-3 gap-4">
          <GoalInput label="Daily" value={goals.daily_target} onChange={v=>setGoals({...goals, daily_target: v})} />
          <GoalInput label="Weekly" value={goals.weekly_target} onChange={v=>setGoals({...goals, weekly_target: v})} />
          <GoalInput label="Monthly" value={goals.monthly_target} onChange={v=>setGoals({...goals, monthly_target: v})} />
        </div>
        <button className="btn btn-primary mt-3" onClick={saveGoals}>Save</button>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-2">Recent entries</h2>
        <ul className="space-y-2">
          {entries.map(e => {
            const meal = labelFromItems(e.items);
            return (
              <li key={e.id} className="flex items-start gap-3">
                <img src={e.image_url} alt="meal" className="w-20 h-20 object-cover rounded-lg border" />
                <div className="flex-1">
                  <div className="font-medium">
                    {new Date(e.created_at).toLocaleString()}
                    {meal && <span className="text-gray-600"> — {meal}</span>}
                  </div>
                  <div className="text-sm text-gray-600">{e.total_calories} kcal</div>
                  {Array.isArray(e.items) && (
                    <div className="text-xs text-gray-500">{e.items.map((i:any)=>i.name).join(', ')}</div>
                  )}
                </div>
                <button className="btn" onClick={() => deleteEntry(e.id)}>Delete</button>
              </li>
            );
          })}
          {entries.length === 0 && !loading && <div className="text-sm text-gray-500">No entries yet.</div>}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, target }: { label: string, value: number, target: number }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value} kcal</div>
      <div className="text-xs text-gray-500">{pct}% of {target} kcal</div>
      <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
        <div className="h-2 bg-black rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function GoalInput({ label, value, onChange }: { label: string, value: number, onChange: (v:number)=>void }) {
  return (
    <label className="block">
      <div className="label">{label} target</div>
      <input className="input" type="number" value={value} onChange={e=>onChange(parseInt(e.target.value || '0', 10))} />
    </label>
  );
}
