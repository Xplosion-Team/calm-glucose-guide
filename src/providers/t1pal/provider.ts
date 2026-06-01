// T1Pal provider — implements a common CGM provider interface so future
// providers (official Dexcom, Apple Health) can be added side-by-side.
import {
  disconnectT1Pal,
  getT1PalConnection,
  saveT1PalConnection,
  syncT1PalNow,
  testT1PalConnection,
  type T1PalConnection,
} from "@/integrations/t1pal/client";

export interface CgmProvider {
  id: string;
  connect: (input: { t1pal_url: string; access_token?: string }) => Promise<{ ok: boolean; error?: string }>;
  validate: (input: { t1pal_url: string; access_token?: string }) => Promise<{ ok: boolean; error?: string }>;
  sync: () => Promise<{ ok: boolean; inserted?: number; error?: string }>;
  disconnect: () => Promise<{ ok: boolean; error?: string }>;
  getConnection: () => Promise<T1PalConnection | null>;
}

export const t1palProvider: CgmProvider = {
  id: "t1pal",
  validate: testT1PalConnection,
  connect: saveT1PalConnection,
  sync: syncT1PalNow,
  disconnect: disconnectT1Pal,
  getConnection: getT1PalConnection,
};
