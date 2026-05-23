/* ══ supabase.js — connexion Supabase ══ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(
  "https://gwpvqpmynlsgbhpouexg.supabase.co",
  "sb_publishable_GHDHKPVV0hRxFifmsl-VvA_MRgsaiZf"
);
