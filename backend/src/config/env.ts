import { config as loadEnvFile } from "dotenv";
import { z } from "zod";

loadEnvFile({ path: ".env.local", quiet: true });
loadEnvFile({ path: ".env", quiet: true });

const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

const supabaseEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const adminEnvSchema = supabaseEnvSchema.extend({
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
});

const emailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(3),
  APP_URL: z.url().default("http://localhost:3000"),
});

export function getRuntimeEnv() {
  return runtimeEnvSchema.parse(process.env);
}

export function getSupabaseEnv() {
  return supabaseEnvSchema.parse(process.env);
}

export function getSupabaseAdminEnv() {
  return adminEnvSchema.parse(process.env);
}

export function getEmailEnv() {
  return emailEnvSchema.parse(process.env);
}
