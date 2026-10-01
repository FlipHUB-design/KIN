import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { today } from "@/lib/kin";

export const AI_MODEL = process.env.KIN_AI_MODEL || process.env.KIN_LETTER_MODEL || "claude-haiku-4-5-20251001";
export const aiOn = () => !!process.env.ANTHROPIC_API_KEY;

export const LIMITS = { setup: 6, help: 40, letter: 30 } as const;

/** Counts one use and says whether the person is still within today's limit. */
export async function takeAllowance(userId: string, kind: keyof typeof LIMITS) {
  const admin = createAdminClient();
  if (!admin) return false;
  const day = today();
  const { data, error } = await admin.from("ai_usage").select("count").eq("user_id", userId).eq("day", day).eq("kind", kind).maybeSingle();
  if (error) { console.error("ai_usage", error.message); return true; }
  const used = data?.count || 0;
  if (used >= LIMITS[kind]) return false;
  await admin.from("ai_usage").upsert({ user_id: userId, day, kind, count: used + 1 });
  return true;
}

type Tool = { name: string; description: string; input_schema: object };

/** Calls Claude and forces a single structured answer through the given tool. */
export async function callTool<T>(opts: { system: string; messages: { role: "user" | "assistant"; content: string }[]; tool: Tool; maxTokens?: number }): Promise<T | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: opts.maxTokens || 2000, system: opts.system,
        tools: [opts.tool], tool_choice: { type: "tool", name: opts.tool.name }, messages: opts.messages,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) { console.error("AI failed", res.status, await res.text().catch(() => "")); return null; }
    const json = await res.json();
    const use = (json.content || []).find((c: { type: string }) => c.type === "tool_use");
    return (use?.input as T) || null;
  } catch (e) { console.error("AI failed", e); return null; }
}
