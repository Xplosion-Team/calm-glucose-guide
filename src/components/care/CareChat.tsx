import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  member_id: string;
  sender_role: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

/** Two-way chat between a member and the care team. `asStaff` = viewer is admin/clinician. */
export function CareChat({ memberId, asStaff }: { memberId: string; asStaff: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const otherRole = asStaff ? "member" : "staff";

  useEffect(() => {
    let active = true;
    const markRead = () =>
      supabase.from("care_messages").update({ read_at: new Date().toISOString() })
        .eq("member_id", memberId).eq("sender_role", otherRole).is("read_at", null);
    supabase.from("care_messages").select("*").eq("member_id", memberId)
      .order("created_at", { ascending: true }).limit(200)
      .then(({ data }) => { if (active) setMsgs((data as Msg[]) ?? []); void markRead(); });
    const ch = supabase.channel(`care-${memberId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "care_messages", filter: `member_id=eq.${memberId}` },
        (p) => {
          setMsgs((m) => (m.some((x) => x.id === (p.new as Msg).id) ? m : [...m, p.new as Msg]));
          if ((p.new as Msg).sender_role === otherRole) void markRead();
        })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [memberId, otherRole]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("care_messages").insert({
        member_id: memberId, sender_id: user.id, sender_role: asStaff ? "staff" : "member", body,
      }).select().single();
      if (data) setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data as Msg]));
      setText("");
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto space-y-3 p-1">
        {msgs.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            {asStaff ? "No messages yet. Say hello." : "Send a message to your care team. They'll reply here."}
          </p>
        )}
        {msgs.map((m) => {
          const mine = (m.sender_role === "staff") === asStaff;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5",
                mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                {!mine && <p className="text-xs font-semibold opacity-80 mb-0.5">{m.sender_role === "staff" ? "Care team" : "Member"}</p>}
                <p className="text-lg whitespace-pre-wrap break-words">{m.body}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <div className="flex gap-2 pt-3 border-t mt-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
          placeholder="Type a message…" className="text-lg min-h-[52px]" rows={2}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <Button onClick={() => void send()} disabled={sending || !text.trim()} size="lg" className="h-auto" aria-label="Send">
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
