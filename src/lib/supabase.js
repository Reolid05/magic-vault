import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "MAGIC VAULT: faltan las variables de conexión con Supabase."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://example.supabase.co",
  supabaseKey || "missing-publishable-key"
);
