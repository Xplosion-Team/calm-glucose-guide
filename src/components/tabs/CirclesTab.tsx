import { useMemo, useState } from "react";
import { Users, UserPlus, Pencil, Trash2, Phone, Mail, Stethoscope, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useScreenContext } from "@/hooks/useScreenContext";
import { GamesSection } from "@/components/circles/GamesSection";
import { PersonFormDialog } from "@/components/circles/PersonFormDialog";
import { useCirclePeople, type CirclePerson } from "@/hooks/useCirclePeople";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function CirclesTab() {
  const { toast } = useToast();
  const { people, loading, addPerson, updatePerson, deletePerson } = useCirclePeople();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CirclePerson | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CirclePerson | null>(null);
  const [deleting, setDeleting] = useState(false);

  useScreenContext(
    useMemo(
      () => ({
        screen: "Circles",
        status:
          people.length === 0
            ? "Your circle is empty. You can add the people who support you."
            : `You have ${people.length} ${people.length === 1 ? "person" : "people"} in your circle.`,
        highlights: people.slice(0, 3).map((p) => `${p.full_name}${p.relationship ? ` — ${p.relationship}` : p.role ? ` — ${p.role}` : ""}`),
        data: { count: people.length },
        fallback:
          people.length === 0
            ? "You're on the Circles screen. There is no one in your circle yet. Want to add someone?"
            : `You're on the Circles screen with ${people.length} trusted people.`,
      }),
      [people],
    ),
  );

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (p: CirclePerson) => {
    setEditing(p);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deletePerson(confirmDelete.id);
      toast({ title: "Person removed", description: `${confirmDelete.full_name} was deleted.` });
      setConfirmDelete(null);
    } catch (e) {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <Users className="w-6 h-6 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-foreground">Your Circles</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          The people who care about you, gently in the loop.
        </p>
      </div>

      <Card className="glass-card border-0">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Trusted people</h3>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Add person
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-base font-medium">No one in your circle yet</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Add family, friends, or your Greens Health care team to keep them in the loop.
              </p>
              <Button onClick={openAdd} className="gap-1.5">
                <UserPlus className="w-4 h-4" />
                Add your first person
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {people.map((p) => (
                <li key={p.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/40">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback
                      className={
                        p.is_greens_health
                          ? "bg-primary/10 text-primary font-semibold"
                          : "bg-secondary text-secondary-foreground font-semibold"
                      }
                    >
                      {initialsOf(p.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{p.full_name}</p>
                      {p.is_greens_health && (
                        <Badge variant="secondary" className="gap-1">
                          <Stethoscope className="w-3 h-3" /> Greens Health
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {p.is_greens_health
                        ? [p.role, p.organization].filter(Boolean).join(" • ") || "Care team"
                        : p.relationship || "Trusted contact"}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {p.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {p.phone}
                        </span>
                      )}
                      {p.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {p.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(p)}
                      aria-label={`Edit ${p.full_name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete(p)}
                      aria-label={`Delete ${p.full_name}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <GamesSection />

      <p className="text-center text-sm text-muted-foreground max-w-sm mx-auto pt-4 border-t">
        You decide what your circle sees. Your data stays yours.
      </p>

      <PersonFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        person={editing}
        onSubmit={async (input) => {
          if (editing) await updatePerson(editing.id, input);
          else await addPerson(input);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDelete?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this person from your circle. You can always add them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removing…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
