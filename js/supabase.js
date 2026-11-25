const SUPABASE_URL = "https://ctdxpoysboylxwkcsalc.supabase.co";
const SUPABASE_KEY = "sb_publishable_I2g3gpcG5kqTtcIfBhw9pw_PdlKOwxu";

const FIRST_KVK_WITH_SUMS = 8;

function kvkHasSums(kvkNumber) {
  return !(Number(kvkNumber) < FIRST_KVK_WITH_SUMS);
}

const SUPABASE_SESSION_KEY = "sb-session";
let supabaseSession = null;
try {
  const saved = JSON.parse(sessionStorage.getItem(SUPABASE_SESSION_KEY) || "null");
  if (saved && saved.expiresAt > Date.now()) supabaseSession = saved;
} catch {
}

function supabaseUser() {
  return supabaseSession ? { email: supabaseSession.email } : null;
}

async function supabaseSignIn(email, password) {
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Could not reach the sign-in service.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error_description || body.msg || body.message || "Sign-in failed.");
  }
  supabaseSession = {
    token: body.access_token,
    email: body.user?.email || email,
    expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000 - 30000,
  };
  try {
    sessionStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(supabaseSession));
  } catch {
  }
  return supabaseUser();
}

function supabaseSignOut() {
  supabaseSession = null;
  try {
    sessionStorage.removeItem(SUPABASE_SESSION_KEY);
  } catch {
  }
}

async function supabaseFetch(path, options = {}) {
  const { auth = false, ...fetchOptions } = options;
  const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {}),
  };
  if (auth) {
    if (!supabaseSession || supabaseSession.expiresAt <= Date.now()) {
      supabaseSignOut();
      throw new Error("You are signed out. Please sign in again.");
    }
    headers.Authorization = `Bearer ${supabaseSession.token}`;
  }

  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...fetchOptions, headers });
  } catch (event) {
    throw new Error("Could not reach the database. Check your connection and try again.");
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const error = await response.json();
      detail = error.message || JSON.stringify(error);
    } catch {
    }
    throw new Error(`Database request failed (${response.status}): ${detail}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function supabaseRpc(functionName, args = {}, options = {}) {
  return supabaseFetch(`rpc/${functionName}`, { ...options, method: "POST", body: JSON.stringify(args) });
}

async function supabaseSelectAll(table, query = "select=*") {
  const PAGE_SIZE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await supabaseFetch(`${table}?${query}`, {
      headers: { "Range-Unit": "items", Range: `${from}-${from + PAGE_SIZE - 1}` },
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function searchGovernorsByName(query, includeScans = false) {
  const trimmedQuery = String(query ?? "").trim();
  if (trimmedQuery.length < 2) return Promise.resolve([]);
  return supabaseRpc("search_governors", { p_q: trimmedQuery, p_include_scans: includeScans }).then((rows) => {
    const seen = new Set();
    return rows.filter((row) => !seen.has(row.id) && seen.add(row.id));
  });
}
