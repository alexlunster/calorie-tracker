// …your existing imports…
import { supabase } from "@/lib/supabaseClient";

// Helper: keep only last 3 photos in storage
async function keepOnlyLast3Photos(userId: string) {
  try {
    const { data: list, error } = await (supabase as any)
      .storage
      .from("photos")
      .list(userId, { limit: 100, sortBy: { column: "updated_at", order: "desc" } });
    if (error || !Array.isArray(list)) return;
    const toDelete = list.slice(3).map((it: any) => `${userId}/${it.name}`);
    if (toDelete.length) {
      await (supabase as any).storage.from("photos").remove(toDelete);
    }
  } catch {
    // ignore
  }
}

// …inside your existing upload logic, after you get `imageUrl` from pub.publicUrl:
const imageUrl = pub.publicUrl;

// clean up storage
keepOnlyLast3Photos(userId);

// then continue with your insert…

// …after a successful insert and analysis, when you dispatch the event:
window.dispatchEvent(
  new CustomEvent<EntryRow>("entry:created", { detail: entry })
);
// legacy event for compatibility
window.dispatchEvent(new Event("entry-added"));
