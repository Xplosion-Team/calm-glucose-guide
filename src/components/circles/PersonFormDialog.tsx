import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { CirclePerson, CirclePersonInput } from "@/hooks/useCirclePeople";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  relationship: z.string().trim().max(60).optional().or(z.literal("")),
  role: z.string().trim().max(60).optional().or(z.literal("")),
  organization: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().max(255).email("Invalid email").optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  is_greens_health: z.boolean(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: CirclePerson | null;
  onSubmit: (input: CirclePersonInput) => Promise<void>;
}

const empty: CirclePersonInput = {
  full_name: "",
  relationship: "",
  role: "",
  organization: "",
  phone: "",
  email: "",
  notes: "",
  is_greens_health: false,
};

export function PersonFormDialog({ open, onOpenChange, person, onSubmit }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<CirclePersonInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        person
          ? {
              full_name: person.full_name,
              relationship: person.relationship ?? "",
              role: person.role ?? "",
              organization: person.organization ?? "",
              phone: person.phone ?? "",
              email: person.email ?? "",
              notes: person.notes ?? "",
              is_greens_health: person.is_greens_health,
            }
          : empty,
      );
    }
  }, [open, person]);

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Please check the form",
        description: parsed.error.issues[0]?.message ?? "Invalid input",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const data = parsed.data;
      await onSubmit({
        full_name: data.full_name,
        relationship: data.relationship || null as unknown as string,
        role: data.role || null as unknown as string,
        organization: data.organization || null as unknown as string,
        phone: data.phone || null as unknown as string,
        email: data.email || null as unknown as string,
        notes: data.notes || null as unknown as string,
        is_greens_health: data.is_greens_health,
      });
      toast({ title: person ? "Person updated" : "Person added" });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{person ? "Edit person" : "Add person"}</DialogTitle>
          <DialogDescription>
            Add someone you trust — family, friend, or a Greens Health team member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name *</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Jane Doe"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="is_greens">Greens Health personnel</Label>
              <p className="text-xs text-muted-foreground">Care team member</p>
            </div>
            <Switch
              id="is_greens"
              checked={form.is_greens_health}
              onCheckedChange={(v) => setForm({ ...form, is_greens_health: v })}
            />
          </div>

          {form.is_greens_health ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role / Title</Label>
                <Input
                  id="role"
                  value={form.role ?? ""}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Diabetes Educator, RN, Coach…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  value={form.organization ?? ""}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  placeholder="Greens Health"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="relationship">Relationship</Label>
              <Input
                id="relationship"
                value={form.relationship ?? ""}
                onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                placeholder="Daughter, spouse, friend…"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 555 123 4567"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Anything helpful to remember"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : person ? "Save changes" : "Add person"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
