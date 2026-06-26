import { useMemo, useState } from "react";
import { Users, Heart, MessageCircle, Bell, ShieldCheck, LinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useScreenContext } from "@/hooks/useScreenContext";
import { GamesSection } from "@/components/circles/GamesSection";
import { AddPersonDialog } from "@/components/circles/AddPersonDialog";
import { PersonDetailsSheet } from "@/components/circles/PersonDetailsSheet";
import { useCirclePeople, type CirclePerson } from "@/hooks/useCirclePeople";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "•";
}

export function CirclesTab() {
  const { people, links, loading } = useCirclePeople();
  const [openPerson, setOpenPerson] = useState<CirclePerson | null>(null);

  useScreenContext(
    useMemo(
      () => ({
        screen: "Circles",
        status: `You have ${people.length} ${people.length === 1 ? "person" : "people"} in your circle.`,
        highlights: [
          `You can add a new person and generate a secure read-only progress link.`,
          `Shared links are view-only — recipients can't make changes.`,
        ],
        data: { members: people.length },
        fallback: `You're on the Circles screen with ${people.length} ${people.length === 1 ? "person" : "people"} in your circle. You can add someone new or share a read-only progress link.`,
      }),
      [people.length],
    ),
  );

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
            <AddPersonDialog onAdded={() => { /* hook re-fetches automatically */ }} />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : people.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                No one in your circle yet. Add a family member, friend, or your Greens Health team.
              </p>
              <AddPersonDialog
                trigger={
                  <Button size="sm" className="gap-1.5">
                    <Users className="w-4 h-4" /> Add your first person
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {people.map((p) => {
                const activeLink = (links[p.id] ?? []).find((l) => l.status === "active");
                return (
                  <button
                    key={p.id}
                    onClick={() => setOpenPerson(p)}
                    className="w-full flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-secondary/40 transition-colors text-left"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                        {initialsOf(p.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">{p.full_name}</p>
                        {p.is_greens_health && (
                          <Badge variant="secondary" className="text-[10px] py-0">Greens Health</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {p.role || p.relationship || p.organization || "Tap to manage access"}
                      </p>
                    </div>
                    {activeLink ? (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <ShieldCheck className="w-3 h-3" /> Shared
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <LinkIcon className="w-3 h-3" /> No link
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PersonDetailsSheet
        person={openPerson}
        open={!!openPerson}
        onOpenChange={(o) => !o && setOpenPerson(null)}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-semibold text-foreground">Recent love</h3>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Bell className="w-4 h-4" aria-hidden="true" />
            Quiet hours
          </Button>
        </div>
        <Card className="glass-card border-0">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Heart className="w-5 h-5 mx-auto mb-2 text-muted-foreground/60" />
            Messages from your circle will appear here.
            <div className="mt-2 inline-flex items-center gap-1 text-xs">
              <MessageCircle className="w-3 h-3" /> Coming soon
            </div>
          </CardContent>
        </Card>
      </div>

      <GamesSection />

      <p className="text-center text-sm text-muted-foreground max-w-sm mx-auto pt-4 border-t">
        You decide what your circle sees. Shared links are read-only.
      </p>
    </div>
  );
}
