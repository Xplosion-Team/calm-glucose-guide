import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCirclePeople, buildShareUrl } from "@/hooks/useCirclePeople";

interface Props {
  onAdded?: (personId: string) => void;
  trigger?: React.ReactNode;
}

export function AddPersonDialog({ onAdded, trigger }: Props) {
  const { toast } = useToast();
  const { addPerson, createShareLink } = useCirclePeople();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isGreens, setIsGreens] = useState(false);
  const [createLink, setCreateLink] = useState(true);
  const [form, setForm] = useState({
    full_name: "",
    relationship: "",
    role: "",
    organization: "",
    phone: "",
    email: "",
    notes: "",
  });

  const reset = () => {
    setForm({ full_name: "", relationship: "", role: "", organization: "", phone: "", email: "", notes: "" });
    setIsGreens(false);
    setCreateLink(true);
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Name required", description: "Please enter the person's name." });
      return;
    }
    setSubmitting(true);
    try {
      const person = await addPerson({
        full_name: form.full_name.trim(),
        relationship: form.relationship.trim() || null,
        role: form.role.trim() || null,
        organization: isGreens ? (form.organization.trim() || "Greens Health") : (form.organization.trim() || null),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        is_greens_health: isGreens,
      });

      let url: string | null = null;
      if (createLink) {
        const link = await createShareLink(person.id);
        url = buildShareUrl(link.token);
        await navigator.clipboard.writeText(url).catch(() => {});
      }

      toast({
        title: `${person.full_name} added`,
        description: url ? "Read-only progress link copied to clipboard." : "You can generate a link from their details.",
      });
      reset();
      setOpen(false);
      onAdded?.(person.id);
    } catch (e: any) {
      toast({ title: "Couldn't add", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
            <UserPlus className="w-4 h-4" /> Add
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add someone to your circle</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Greens Health team member</p>
              <p className="text-sm text-muted-foreground">Adds role & organization fields.</p>
            </div>
            <Switch checked={isGreens} onCheckedChange={setIsGreens} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="full_name">Full name *</Label>
            <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>

          {isGreens ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="role">Role / title</Label>
                <Input id="role" placeholder="e.g. Care coordinator, RN, MD" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="organization">Organization</Label>
                <Input id="organization" placeholder="Greens Health" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="relationship">Relationship</Label>
              <Input id="relationship" placeholder="e.g. Daughter, Spouse, Friend" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 bg-secondary/30">
            <div>
              <p className="font-medium">Generate read-only progress link</p>
              <p className="text-sm text-muted-foreground">View progress only — they can't make changes.</p>
            </div>
            <Switch checked={createLink} onCheckedChange={setCreateLink} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Add person
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
