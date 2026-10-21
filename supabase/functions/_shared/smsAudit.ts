// Audit trail for every text message that leaves or reaches the app.
// Writes are best-effort: an audit failure must never break message delivery
// or the inbound webhook response.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SmsEvent {
  userId?: string | null;
  direction: "outbound" | "inbound";
  phone: string;
  body: string;
  provider?: string | null;
  /** sent | failed | received | ignored */
  status: string;
  errorMessage?: string | null;
  /** why we sent it, or how an inbound text was interpreted */
  purpose?: string | null;
  /** what the message resulted in, e.g. "saved food log" */
  outcome?: string | null;
  relatedTable?: string | null;
  relatedId?: string | null;
  metadata?: Record<string, unknown>;
}

function auditClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function logSmsEvent(event: SmsEvent): Promise<string | null> {
  try {
    const { data, error } = await auditClient()
      .from("sms_events")
      .insert({
        user_id: event.userId ?? null,
        direction: event.direction,
        phone: event.phone,
        body: event.body ?? "",
        provider: event.provider ?? null,
        status: event.status,
        error_message: event.errorMessage ?? null,
        purpose: event.purpose ?? null,
        outcome: event.outcome ?? null,
        related_table: event.relatedTable ?? null,
        related_id: event.relatedId ?? null,
        metadata: event.metadata ?? {},
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("sms_events insert failed", error);
      return null;
    }
    await mirrorToCareChat(event);
    return (data?.id as string) ?? null;
  } catch (e) {
    console.error("sms_events insert threw", e);
    return null;
  }
}

// Decides how a text shows up in the care team chat. Returns null when the
// text must not be mirrored: no linked member, or a staff-authored send
// (metadata.skip_mirror) that already appears in the chat as a staff message.
export function careMirrorRole(event: Pick<SmsEvent, "userId" | "direction" | "metadata">): "sms_in" | "sms_out" | null {
  if (!event.userId || event.metadata?.skip_mirror) return null;
  return event.direction === "inbound" ? "sms_in" : "sms_out";
}

// Shows member texts in the care team chat so staff see one timeline.
async function mirrorToCareChat(event: SmsEvent) {
  const role = careMirrorRole(event);
  if (!role) return;
  try {
    const { error } = await auditClient().from("care_messages").insert({
      member_id: event.userId,
      sender_id: event.userId,
      sender_role: role,
      body: event.body ?? "",
    });
    if (error) console.error("care_messages mirror failed", error);
  } catch (e) {
    console.error("care_messages mirror threw", e);
  }
}

// Fills in the result of an inbound message once we know what it turned into.
export async function updateSmsEvent(
  id: string | null,
  patch: Partial<Pick<SmsEvent, "outcome" | "status" | "relatedTable" | "relatedId" | "purpose">> & {
    metadata?: Record<string, unknown>;
  },
) {
  if (!id) return;
  try {
    const { error } = await auditClient()
      .from("sms_events")
      .update({
        ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.purpose !== undefined ? { purpose: patch.purpose } : {}),
        ...(patch.relatedTable !== undefined ? { related_table: patch.relatedTable } : {}),
        ...(patch.relatedId !== undefined ? { related_id: patch.relatedId } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      })
      .eq("id", id);
    if (error) console.error("sms_events update failed", error);
  } catch (e) {
    console.error("sms_events update threw", e);
  }
}
