// ==============================================================================
// Johnny TEC AI Reply - Frontend Configuration
// ==============================================================================
// FILL IN THESE THREE VALUES AFTER CREATING SUPABASE & DEPLOYING TO RENDER:
// Example:
// export const API_BASE_URL = "https://johnny-tec-ai-reply.onrender.com";
// export const SUPABASE_URL = "https://xyzref.supabase.co";
// export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
// ==============================================================================

export const API_BASE_URL = "";
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export function getActiveApiUrl() {
  const override = localStorage.getItem("jt_api_override");
  if (override && override.trim()) {
    return override.trim().replace(/\/+$/, "");
  }
  return (API_BASE_URL || "").trim().replace(/\/+$/, "");
}

export function getActiveSupabaseUrl() {
  const override = localStorage.getItem("jt_supabase_url_override");
  if (override && override.trim()) {
    return override.trim().replace(/\/+$/, "");
  }
  return (SUPABASE_URL || "").trim().replace(/\/+$/, "");
}

export function getActiveSupabaseKey() {
  const override = localStorage.getItem("jt_supabase_key_override");
  if (override && override.trim()) {
    return override.trim();
  }
  return (SUPABASE_ANON_KEY || "").trim();
}

export function isConfigured() {
  const api = getActiveApiUrl();
  const sbUrl = getActiveSupabaseUrl();
  const sbKey = getActiveSupabaseKey();

  const isInvalidUrl = (u) => !u || u.includes("YOUR_") || u.includes("your-project") || u.length < 8;
  const isInvalidKey = (k) => !k || k.includes("YOUR_") || k.includes("...") || k.length < 20;

  if (isInvalidUrl(api)) return false;
  if (isInvalidUrl(sbUrl)) return false;
  if (isInvalidKey(sbKey)) return false;

  return true;
}
