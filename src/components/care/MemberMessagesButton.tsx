import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CareChat } from "./CareChat";

/** Member-side "Care team" button with unread badge; opens the chat. */
export function MemberMessagesButton() {
  const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!uid) return;
    const load = () =>
      supabase.from("care_messages").select("id", { count: "exact", head: true })
        .eq("member_id", uid).eq("sender_role", "staff").is("read_at", null)
        .then(({ count }) => setUnread(count ?? 0));
    void load();
    const ch = supabase.channel(`care-badge-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "care_messages", filter: `member_id=eq.${uid}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, open]);

  if (!uid) return null;
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="gap-1 text-muted-foreground relative">
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
        Care team
        {unread > 0 && (
          <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-1.5 min-w-5 text-center">{unread}</span>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85dvh] flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader><SheetTitle className="text-2xl">Your care team</SheetTitle></SheetHeader>
          <div className="flex-1 min-h-0 mt-2"><CareChat memberId={uid} asStaff={false} /></div>
        </SheetContent>
      </Sheet>
    </>
  );
}
