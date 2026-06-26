import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Link as LinkIcon, RefreshCw, ShieldCheck, ShieldOff, Share2, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildShareUrl, useCirclePeople, type CirclePerson, type ShareLink } from "@/hooks/useCirclePeople";

interface Props {
  person: CirclePerson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonDetailsSheet({ person, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { links, createShareLink, revokeShareLink, regenerateShareLink } = useCirclePeople();
  const [busy, setBusy] = useState(false);

  const personLinks = useMemo(
    () => (person ? links[person.id] ?? [] : []),
    [person, links],
  );
  const activeLink = personLinks.find((l) => l.status === "active") ?? null;

  const handleGenerate = async () => {
    if (!person) return;
    setBusy(true);
    try {
      const link = await createShareLink(person.id);
      await navigator.clipboard.writeText(buildShareUrl(link.token)).catch(() => {});
      toast({ title: "Link created", description: "Read-only progress link copied to clipboard." });
    } catch (e: any) {
      toast({ title: "Couldn't create link", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (link: ShareLink) => {
    await navigator.clipboard.writeText(buildShareUrl(link.token)).catch(() => {});
    toast({ title: "Link copied" });
  };

  const handleShare = async (link: ShareLink) => {
    const url = buildShareUrl(link.token);
    const text = `View my Calm Glucose progress (read-only): ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Calm Glucose progress", text, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    toast({ title: "Link copied", description: "Paste it into a message or email." });
  };

  const handleRevoke = async (link: ShareLink) => {
    setBusy(true);
    try {
      await revokeShareLink(link.id);
      toast({ title: "Access revoked", description: "The old link no longer works." });
    } catch (e: any) {
      toast({ title: "Couldn't revoke", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    if (!person) return;
    setBusy(true);
    try {
      const link = await regenerateShareLink(person.id);
      await navigator.clipboard.writeText(buildShareUrl(link.token)).catch(() => {});
      toast({ title: "New link generated", description: "Old link revoked. New link copied." });
    } catch (e: any) {
      toast({ title: "Couldn't regenerate", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!person) return null;

  const statusBadge = (l: ShareLink) => {
    if (l.status === "active") return <Badge className="gap-1"><ShieldCheck className="w-3 h-3" /> Active</Badge>;
    if (l.status === "revoked") return <Badge variant="secondary" className="gap-1"><ShieldOff className="w-3 h-3" /> Revoked</Badge>;
    return <Badge variant="outline" className="gap-1"><ShieldAlert className="w-3 h-3" /> Expired</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{person.full_name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div className="rounded-lg border p-3 space-y-1 text-sm">
            {person.is_greens_health && (
              <Badge variant="secondary" className="mb-1">Greens Health</Badge>
            )}
            {person.role && <p><span className="text-muted-foreground">Role: </span>{person.role}</p>}
            {person.organization && <p><span className="text-muted-foreground">Org: </span>{person.organization}</p>}
            {person.relationship && <p><span className="text-muted-foreground">Relationship: </span>{person.relationship}</p>}
            {person.phone && <p><span className="text-muted-foreground">Phone: </span>{person.phone}</p>}
            {person.email && <p><span className="text-muted-foreground">Email: </span>{person.email}</p>}
            {person.notes && <p className="text-muted-foreground italic mt-2">{person.notes}</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Read-only progress access</h3>
              <Badge variant="outline" className="gap-1"><ShieldCheck className="w-3 h-3" /> View progress only</Badge>
            </div>

            {!activeLink && (
              <div className="rounded-lg border border-dashed p-4 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  No active link yet. Generate a secure, read-only link so {person.full_name} can view your progress.
                </p>
                <Button onClick={handleGenerate} disabled={busy} className="gap-1.5">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                  Generate read-only link
                </Button>
              </div>
            )}

            {activeLink && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  {statusBadge(activeLink)}
                  <span className="text-xs text-muted-foreground">
                    Created {new Date(activeLink.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="rounded bg-secondary/40 p-2 text-xs break-all font-mono">
                  {buildShareUrl(activeLink.token)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {activeLink.last_viewed_at
                    ? `Last viewed ${new Date(activeLink.last_viewed_at).toLocaleString()} · ${activeLink.view_count} views`
                    : "Not yet viewed."}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopy(activeLink)} className="gap-1.5">
                    <Copy className="w-4 h-4" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleShare(activeLink)} className="gap-1.5">
                    <Share2 className="w-4 h-4" /> Share
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={busy} className="gap-1.5">
                    <RefreshCw className="w-4 h-4" /> Regenerate
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleRevoke(activeLink)} disabled={busy} className="gap-1.5">
                    <ShieldOff className="w-4 h-4" /> Revoke
                  </Button>
                </div>
              </div>
            )}

            {personLinks.filter((l) => l.status !== "active").length > 0 && (
              <details className="rounded-lg border p-3">
                <summary className="text-sm font-medium cursor-pointer">Past links</summary>
                <ul className="mt-2 space-y-2 text-xs">
                  {personLinks.filter((l) => l.status !== "active").map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono">…{l.token.slice(-8)}</span>
                      {statusBadge(l)}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-xs text-muted-foreground">
              Recipients can only see your progress summary. They cannot edit, log entries, or open any other part of your account.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
