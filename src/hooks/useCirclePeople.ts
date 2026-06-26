import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CirclePerson {
  id: string;
  user_id: string;
  full_name: string;
  relationship: string | null;
  role: string | null;
  organization: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_greens_health: boolean;
  created_at: string;
}

export interface ShareLink {
  id: string;
  person_id: string;
  token: string;
  scope: string;
  status: "active" | "revoked" | "expired";
  expires_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  created_at: string;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildShareUrl(token: string): string {
  return `${window.location.origin}/shared/${token}`;
}

export function useCirclePeople() {
  const [people, setPeople] = useState<CirclePerson[]>([]);
  const [links, setLinks] = useState<Record<string, ShareLink[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        setPeople([]);
        setLinks({});
        return;
      }
      const [peopleRes, linksRes] = await Promise.all([
        (supabase as any)
          .from("circle_people")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("circle_share_links")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (peopleRes.error) throw peopleRes.error;
      if (linksRes.error) throw linksRes.error;
      setPeople((peopleRes.data ?? []) as CirclePerson[]);
      const grouped: Record<string, ShareLink[]> = {};
      for (const l of (linksRes.data ?? []) as ShareLink[]) {
        (grouped[l.person_id] ||= []).push(l);
      }
      setLinks(grouped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load people");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addPerson = useCallback(
    async (input: Omit<CirclePerson, "id" | "user_id" | "created_at">) => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) throw new Error("Sign in required");
      const { data, error } = await (supabase as any)
        .from("circle_people")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      await load();
      return data as CirclePerson;
    },
    [load],
  );

  const createShareLink = useCallback(
    async (personId: string, expiresInDays?: number) => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) throw new Error("Sign in required");
      const token = generateToken();
      const expires_at = expiresInDays
        ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
        : null;
      const { data, error } = await (supabase as any)
        .from("circle_share_links")
        .insert({
          user_id: user.id,
          person_id: personId,
          token,
          scope: "progress_readonly",
          status: "active",
          expires_at,
        })
        .select()
        .single();
      if (error) throw error;
      await load();
      return data as ShareLink;
    },
    [load],
  );

  const revokeShareLink = useCallback(
    async (linkId: string) => {
      const { error } = await (supabase as any)
        .from("circle_share_links")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", linkId);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const regenerateShareLink = useCallback(
    async (personId: string) => {
      // Revoke any active links for this person, then create a new one.
      const active = (links[personId] ?? []).filter((l) => l.status === "active");
      for (const l of active) {
        await (supabase as any)
          .from("circle_share_links")
          .update({ status: "revoked", revoked_at: new Date().toISOString() })
          .eq("id", l.id);
      }
      return createShareLink(personId);
    },
    [createShareLink, links],
  );

  return {
    people,
    links,
    loading,
    error,
    refresh: load,
    addPerson,
    createShareLink,
    revokeShareLink,
    regenerateShareLink,
  };
}
