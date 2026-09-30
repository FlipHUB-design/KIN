import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Circle, Member, Role } from "@/lib/kin";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
});

/**
 * Loads a circle and the viewer's role in it. The database only returns the
 * circle if the viewer is an active member, so a changed URL shows "not found".
 */
export const getCircle = cache(async (circleId: string) => {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  if (!/^[0-9a-f-]{36}$/i.test(circleId)) notFound();
  const [{ data: circle }, { data: members }] = await Promise.all([
    supabase.from("care_circles").select("*").eq("id", circleId).maybeSingle(),
    supabase.from("memberships").select("*, profiles(display_name, phone)").eq("circle_id", circleId).order("created_at"),
  ]);
  if (!circle) notFound();
  const me = (members as Member[] | null)?.find((m) => m.user_id === user.id);
  if (!me || me.status !== "active") notFound();
  const list = (members || []) as Member[];
  const nameOf = (id: string | null | undefined) => {
    if (!id) return "Someone";
    if (id === user.id) return "You";
    return (list.find((m) => m.user_id === id)?.profiles?.display_name || "Someone").split(" ")[0];
  };
  return { supabase, user, circle: circle as Circle, role: me.role as Role, me, members: list, nameOf };
});
