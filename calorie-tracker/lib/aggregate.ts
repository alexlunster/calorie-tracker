export function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}
export function startOfWeek(d = new Date()) {
  const x = new Date(d); const day = x.getDay(); const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff); x.setHours(0,0,0,0); return x;
}
export function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0,0,0,0); return x;
}