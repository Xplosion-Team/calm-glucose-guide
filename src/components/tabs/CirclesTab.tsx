import { useMemo, useState } from "react";
import { Users, Heart, MessageCircle, UserPlus, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useScreenContext } from "@/hooks/useScreenContext";

interface CircleMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  status: "online" | "away" | "offline";
  lastShared?: string;
}

interface Update {
  id: string;
  who: string;
  initials: string;
  text: string;
  when: string;
  reactions: number;
}

const MEMBERS: CircleMember[] = [
  { id: "1", name: "Dr. Patel", role: "Care team", initials: "DP", status: "online", lastShared: "Reviewed your week" },
  { id: "2", name: "Sarah", role: "Daughter", initials: "S", status: "online", lastShared: "Sent a heart" },
  { id: "3", name: "James", role: "Son", initials: "J", status: "away" },
  { id: "4", name: "Margot", role: "Friend", initials: "M", status: "offline" },
];

const UPDATES: Update[] = [
  {
    id: "1",
    who: "Sarah",
    initials: "S",
    text: "So proud of your steady week, Mom! ❤️",
    when: "2h ago",
    reactions: 3,
  },
  {
    id: "2",
    who: "Dr. Patel",
    initials: "DP",
    text: "Your overnight readings look beautiful. Keep doing what you're doing.",
    when: "Yesterday",
    reactions: 5,
  },
  {
    id: "3",
    who: "James",
    initials: "J",
    text: "Walked the dog with you in spirit this morning 🐕",
    when: "2 days ago",
    reactions: 2,
  },
];

export function CirclesTab() {
  const { toast } = useToast();
  const [reactedIds, setReactedIds] = useState<Set<string>>(new Set());

  const handleReact = (id: string) => {
    setReactedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleInvite = () => {
    toast({
      title: "Invite link copied",
      description: "Share it with someone you trust to add them to your circle.",
    });
  };

  const statusColor = {
    online: "bg-status-stable",
    away: "bg-status-rising",
    offline: "bg-muted-foreground/40",
  } as const;

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Hero */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <Users className="w-6 h-6 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-foreground">Your Circles</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          The people who care about you, gently in the loop.
        </p>
      </div>

      {/* Members */}
      <Card className="glass-card border-0">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Trusted people</h3>
            <Button variant="ghost" size="sm" onClick={handleInvite} className="gap-1.5 text-primary">
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Invite
            </Button>
          </div>

          <div className="space-y-3">
            {MEMBERS.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                      {m.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-card ${statusColor[m.status]}`}
                    aria-label={m.status}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{m.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {m.lastShared ?? m.role}
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Message ${m.name}`}>
                  <MessageCircle className="w-5 h-5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-semibold text-foreground">Recent love</h3>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Bell className="w-4 h-4" aria-hidden="true" />
            Quiet hours
          </Button>
        </div>

        {UPDATES.map((u) => {
          const reacted = reactedIds.has(u.id);
          const count = u.reactions + (reacted ? 1 : 0);
          return (
            <Card key={u.id} className="glass-card border-0">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {u.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="font-semibold text-foreground">{u.who}</p>
                      <span className="text-xs text-muted-foreground">{u.when}</span>
                    </div>
                    <p className="text-base text-foreground leading-relaxed mt-1">{u.text}</p>
                    <button
                      onClick={() => handleReact(u.id)}
                      className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                        reacted ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                      aria-pressed={reacted}
                    >
                      <Heart
                        className={`w-4 h-4 ${reacted ? "fill-current" : ""}`}
                        aria-hidden="true"
                      />
                      {count}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground max-w-sm mx-auto pt-4 border-t">
        You decide what your circle sees. Your data stays yours.
      </p>
    </div>
  );
}
