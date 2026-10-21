import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Roles for the signed-in person: admin, and staff (admin or clinician). */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) { setIsAdmin(false); setIsStaff(false); setLoading(false); }
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data ?? []).map((r) => r.role as string);
      if (active) {
        setIsAdmin(roles.includes("admin"));
        setIsStaff(roles.includes("admin") || roles.includes("clinician"));
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return { isAdmin, isStaff, loading };
}
