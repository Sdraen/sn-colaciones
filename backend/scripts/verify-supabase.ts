import { createAdminSupabaseClient } from "../src/lib/supabase.js";

const supabase = createAdminSupabaseClient();
const { error } = await supabase
  .from("organizations")
  .select("id", { count: "exact", head: true });

if (error) {
  throw new Error(`No fue posible validar Supabase: ${error.message}`);
}

console.log("Supabase administrativo: conexión verificada; credenciales ocultas.");
