const loginCard = document.getElementById("login-card");
const importCard = document.getElementById("import-card");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginButton = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");
const signedInAs = document.getElementById("signed-in-as");
const logoutButton = document.getElementById("logout-btn");
const authStatus = document.getElementById("auth-status");

let importIsAdmin = false;
const ROWS_PER_REQUEST = 1500;

function setStatus(element, text, kind = "") {
  element.textContent = text;
  element.className = "muted" + (kind ? ` kvk-status-${kind}` : "");
}

function todayIso() {
  const now = new Date();
  const padTwoDigits = (number) => String(number).padStart(2, "0");
  return `${now.getFullYear()}-${padTwoDigits(now.getMonth() + 1)}-${padTwoDigits(now.getDate())}`;
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
  const user = supabaseUser();
  loginCard.style.display = user ? "none" : "";
  importCard.style.display = user ? "" : "none";
  importIsAdmin = false;
  if (user) {
    signedInAs.textContent = user.email;
    setStatus(authStatus, "Checking your access…");
    try {
      importIsAdmin = (await supabaseRpc("is_kvk_admin", {}, { auth: true })) === true;
      setStatus(
        authStatus,
        importIsAdmin ? "" : "This account is not allowed to import data.",
        importIsAdmin ? "" : "err",
      );
    } catch (event) {
      supabaseSignOut();
      setStatus(loginStatus, event.message, "err");
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
  loginButton.disabled = true;
  setStatus(loginStatus, "Signing in…");
  try {
    await supabaseSignIn(email, password);
    loginPassword.value = "";
    setStatus(loginStatus, "");
    await refreshAuthUi();
  } catch (event) {
    setStatus(loginStatus, event.message, "err");
  } finally {
    loginButton.disabled = false;
  }
}

loginButton.addEventListener("click", signIn);
loginPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") signIn();
});
logoutButton.addEventListener("click", () => {
  supabaseSignOut();
  refreshAuthUi();
});

document.querySelectorAll(".import-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".import-tab").forEach((otherTab) => otherTab.classList.toggle("active", otherTab === tab));
    document
      .querySelectorAll(".import-panel")
      .forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${tab.dataset.tab}`));
  });
});

refreshAuthUi();
