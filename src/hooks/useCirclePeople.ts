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
  updated_at: string;
}

export type CirclePersonInput = Omit<
  CirclePerson,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export function useCirclePeople() {
  const [people, setPeople] = useState<CirclePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("circle_people")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setPeople((data ?? []) as CirclePerson[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addPerson = async (input: CirclePersonInput) => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("circle_people")
      .insert({ ...input, user_id: uid })
      .select()
      .single();
    if (error) throw error;
    setPeople((prev) => [data as CirclePerson, ...prev]);
    return data as CirclePerson;
  };

  const updatePerson = async (id: string, patch: Partial<CirclePersonInput>) => {
    const { data, error } = await supabase
      .from("circle_people")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setPeople((prev) => prev.map((p) => (p.id === id ? (data as CirclePerson) : p)));
    return data as CirclePerson;
  };

  const deletePerson = async (id: string) => {
    const { error } = await supabase.from("circle_people").delete().eq("id", id);
    if (error) throw error;
    setPeople((prev) => prev.filter((p) => p.id !== id));
  };

  return { people, loading, error, refresh: load, addPerson, updatePerson, deletePerson };
}
