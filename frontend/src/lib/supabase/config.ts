const missingConfigMessage =
  "La configuración del sistema está incompleta. Contacta a la administración.";

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(missingConfigMessage);
  }

  return { url, publishableKey };
}
