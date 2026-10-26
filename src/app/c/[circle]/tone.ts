"use server";
import { getCircle } from "@/lib/data";
import { aiOn, calmRewrite, takeAllowance } from "@/lib/ai";

export type ToneResult = { ok: true; verdict: "fine" | "could_be_calmer"; suggestion: string; why: string } | { ok: false; message: string };

/** Suggests a calmer wording for a message. Nothing is sent or saved. */
export async function checkTone(circleId: string, text: string): Promise<ToneResult> {
  const { user, circle } = await getCircle(circleId);
  const draft = String(text || "").trim();
  if (draft.length < 8) return { ok: false, message: "Write a little more first." };
  if (!aiOn()) return { ok: false, message: "The calm message helper isn't switched on yet." };
  if (!(await takeAllowance(user.id, "tone"))) return { ok: false, message: "You've used the helper a lot today. Try again tomorrow." };
  const r = await calmRewrite(draft, circle.kind === "children" ? "children" : "care");
  return r ? { ok: true, ...r } : { ok: false, message: "The helper couldn't respond just now. Please try again." };
}
