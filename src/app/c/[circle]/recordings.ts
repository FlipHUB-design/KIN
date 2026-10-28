"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCircle } from "@/lib/data";

const UUID = /^[0-9a-f-]{36}$/i;

/** Files a recording the browser has just uploaded. The audio itself goes straight to storage. */
export async function saveRecording(circleId: string, appointmentId: string, path: string, mime: string, seconds: number, consent: boolean): Promise<{ id?: string; error?: string }> {
  if (!UUID.test(circleId) || !UUID.test(appointmentId)) return { error: "Couldn't find that appointment." };
  if (!consent) return { error: "Please confirm the doctor or nurse is happy to be recorded." };
  if (!path.startsWith(`${circleId}/`) || path.includes("..")) return { error: "That recording couldn't be saved." };
  const { supabase, user } = await getCircle(circleId);
  const { data, error } = await supabase.from("appointment_recordings").insert({
    circle_id: circleId, appointment_id: appointmentId, storage_path: path, mime: mime.slice(0, 80),
    seconds: Math.max(0, Math.min(7200, Math.round(seconds || 0))), consent_confirmed: true, recorded_by: user.id,
  }).select("id").single();
  if (error || !data) {
    await supabase.storage.from("recordings").remove([path]);
    return { error: "Only the family can save recordings of appointments." };
  }
  await supabase.rpc("record_activity", { p_circle: circleId, p_verb: "recorded the appointment:", p_subject: (await supabase.from("appointments").select("title").eq("id", appointmentId).maybeSingle()).data?.title || null });
  return { id: data.id };
}

/** Deletes the audio, keeping the written summary; or the whole recording. */
export async function deleteRecording(f: FormData) {
  const circleId = String(f.get("circle")), id = String(f.get("id")), appt = String(f.get("appointment"));
  const all = f.get("all") === "yes";
  const { supabase } = await getCircle(circleId);
  const { data: r } = await supabase.from("appointment_recordings").select("storage_path").eq("id", id).maybeSingle();
  if (r?.storage_path) await supabase.storage.from("recordings").remove([r.storage_path]);
  if (all) await supabase.from("appointment_recordings").delete().eq("id", id);
  else {
    // Clearing the path needs the server: people can't edit recordings directly
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: still } = await supabase.from("appointment_recordings").select("id").eq("id", id).maybeSingle();
    if (admin && still) {
      const { data: me } = await supabase.auth.getUser();
      const { data: row } = await admin.from("appointment_recordings").select("recorded_by, circle_id").eq("id", id).single();
      const { data: role } = await admin.from("memberships").select("role").eq("circle_id", row!.circle_id).eq("user_id", me.user!.id).eq("status", "active").maybeSingle();
      if (row?.recorded_by === me.user?.id || role?.role === "admin" || role?.role === "family")
        await admin.from("appointment_recordings").update({ storage_path: null, audio_deleted_at: new Date().toISOString() }).eq("id", id);
    }
  }
  revalidatePath(`/c/${circleId}`, "layout");
  redirect(`/c/${circleId}/appointments/${appt}?notice=${encodeURIComponent(all ? "Recording deleted" : "Audio deleted. The written notes are kept.")}#recordings`);
}
