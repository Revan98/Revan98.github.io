const loginCard = document.getElementById("login-card");
const importCard = document.getElementById("import-card");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");
const signedInAs = document.getElementById("signed-in-as");
const logoutBtn = document.getElementById("logout-btn");
const authStatus = document.getElementById("auth-status");

let importIsAdmin = false;
const ROWS_PER_REQUEST = 1500;

function setStatus(el, text, kind = "") {
  el.textContent = text;
  el.className = "muted" + (kind ? ` kvk-status-${kind}` : "");
}

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function readWorkbook(file) {
  const bytes = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
  return XLSX.read(bytes, { type: "array" });
}

async function refreshAuthUi() {
  const user = sbUser();
  loginCard.style.display = user ? "none" : "";
  importCard.style.display = user ? "" : "none";
  importIsAdmin = false;
  if (user) {
    signedInAs.textContent = user.email;
    setStatus(authStatus, "Checking your access…");
    try {
      importIsAdmin = (await sbRpc("is_kvk_admin", {}, { auth: true })) === true;
      setStatus(
        authStatus,
        importIsAdmin ? "" : "This account is not allowed to import data.",
        importIsAdmin ? "" : "err",
      );
    } catch (e) {
      sbSignOut();
      setStatus(loginStatus, e.message, "err");
      await refreshAuthUi();
      return;
    }
  }
  document.dispatchEvent(new CustomEvent("import-auth"));
}

async function signIn() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    setStatus(loginStatus, "Enter your email and password.", "err");
    return;
  }
  loginBtn.disabled = true;
  setStatus(loginStatus, "Signing in…");
  try {
    await sbSignIn(email, password);
    loginPassword.value = "";
    setStatus(loginStatus, "");
    await refreshAuthUi();
  } catch (e) {
    setStatus(loginStatus, e.message, "err");
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", signIn);
loginPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") signIn();
});
logoutBtn.addEventListener("click", () => {
  sbSignOut();
  refreshAuthUi();
});

document.querySelectorAll(".import-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".import-tab").forEach((t) => t.classList.toggle("active", t === tab));
    document
      .querySelectorAll(".import-panel")
      .forEach((p) => p.classList.toggle("active", p.id === `panel-${tab.dataset.tab}`));
  });
});

refreshAuthUi();
