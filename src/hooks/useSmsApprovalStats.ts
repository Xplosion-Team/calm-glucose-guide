import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SmsApprovalRow {
  user_id: string;
  label: string;
  approved: number;
  pending: number;
  discarded: number;
  inbound_messages: number;
  outbound_messages: number;
  last_activity: string;
}

/** Admin-only rollup of texted-in meals: approved, awaiting reply, discarded. */
export function useSmsApprovalStats(days = 30) {
  const [rows, setRows] = useState<SmsApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_sms_approval_stats", { _days: days });
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setError(null);
      setRows((data as SmsApprovalRow[]) ?? []);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, error, refresh: load };
}
