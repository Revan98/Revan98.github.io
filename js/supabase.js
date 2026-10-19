const SUPABASE_URL = "https://ctdxpoysboylxwkcsalc.supabase.co";
const SUPABASE_KEY = "sb_publishable_I2g3gpcG5kqTtcIfBhw9pw_PdlKOwxu";

const FIRST_KVK_WITH_SUMS = 8;

function kvkHasSums(kvkNumber) {
  return !(Number(kvkNumber) < FIRST_KVK_WITH_SUMS);
}

const SB_SESSION_KEY = "sb-session";
let sbSession = null;
try {
  const saved = JSON.parse(sessionStorage.getItem(SB_SESSION_KEY) || "null");
  if (saved && saved.expiresAt > Date.now()) sbSession = saved;
} catch {
}

function sbUser() {
  return sbSession ? { email: sbSession.email } : null;
}

async function sbSignIn(email, password) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Could not reach the sign-in service.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error_description || body.msg || body.message || "Sign-in failed.");
  }
  sbSession = {
    token: body.access_token,
    email: body.user?.email || email,
    expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000 - 30000,
  };
  try {
    sessionStorage.setItem(SB_SESSION_KEY, JSON.stringify(sbSession));
  } catch {
  }
  return sbUser();
}

function sbSignOut() {
  sbSession = null;
  try {
    sessionStorage.removeItem(SB_SESSION_KEY);
  } catch {
  }
}

async function sbFetch(path, options = {}) {
  const { auth = false, ...fetchOptions } = options;
  const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {}),
  };
  if (auth) {
    if (!sbSession || sbSession.expiresAt <= Date.now()) {
      sbSignOut();
      throw new Error("You are signed out. Please sign in again.");
    }
    headers.Authorization = `Bearer ${sbSession.token}`;
  }

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...fetchOptions, headers });
  } catch (e) {
    throw new Error("Could not reach the database. Check your connection and try again.");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.message || JSON.stringify(err);
    } catch {
    }
    throw new Error(`Database request failed (${res.status}): ${detail}`);
  }
  return res.json();
}

function sbRpc(fn, args = {}, options = {}) {
  return sbFetch(`rpc/${fn}`, { ...options, method: "POST", body: JSON.stringify(args) });
}

async function sbSelectAll(table, query = "select=*") {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const page = await sbFetch(`${table}?${query}`, {
      headers: { "Range-Unit": "items", Range: `${from}-${from + PAGE - 1}` },
    });
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

function searchGovernorsByName(query, includeScans = false) {
  const q = String(query ?? "").trim();
  if (q.length < 2) return Promise.resolve([]);
  return sbRpc("search_governors", { p_q: q, p_include_scans: includeScans }).then((rows) => {
    const seen = new Set();
    return rows.filter((r) => !seen.has(r.id) && seen.add(r.id));
  });
}
