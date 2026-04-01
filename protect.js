import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ===============================
//  SUPABASE
// ===============================
const supabase = createClient(
    "https://mpnfvrizbluhhjcfzztc.supabase.co",
    "sb-publishable_PM0kkir75Ebuvi1gUlpmNTQ_7KTnMrEr"
);

// ===============================
//  VÉRIFICATION SESSION
// ===============================
const { data } = await supabase.auth.getSession();
if (!data.session) window.location.href = "index.html";

const user = data.session.user;

// ===============================
//  AVATAR
// ===============================
const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`;

document.getElementById("avatarIcon").src = avatarUrl;
document.getElementById("popupAvatar").src = avatarUrl;

// ===============================
//  PSEUDO + EMAIL
// ===============================
const username = user.email.split("@")[0];

document.getElementById("popupUsername").textContent = username;
document.getElementById("popupEmail").textContent = user.email;

document.getElementById("lineUsername").textContent = username;
document.getElementById("lineEmail").textContent = user.email;

// ===============================
//  CLASSE DU COMPTE
// ===============================
// Tu peux changer ici : "Free", "Pro", "Admin", "Premium"
let accountClass = "Free";

document.getElementById("userClass").textContent = accountClass;

// ===============================
//  MOT DE PASSE CACHÉ + BOUTON ŒIL
// ===============================
let passwordVisible = false;

const passwordSpan = document.getElementById("linePassword");
const toggleBtn = document.getElementById("togglePassword");

const fakePassword = "••••••••";        // affiché par défaut
const realPassword = "motdepasse123";   // tu peux mettre ce que tu veux

toggleBtn.addEventListener("click", () => {
    passwordVisible = !passwordVisible;

    if (passwordVisible) {
        passwordSpan.textContent = realPassword;
        toggleBtn.textContent = "🙈";
    } else {
        passwordSpan.textContent = fakePassword;
        toggleBtn.textContent = "👁️";
    }
});

// ===============================
//  POPUP COMPTE
// ===============================
const popup = document.getElementById("accountPopup");
const accountBtn = document.getElementById("accountBtn");

accountBtn.addEventListener("click", () => {
    popup.classList.toggle("hidden");
});

// Fermer si on clique ailleurs
document.addEventListener("click", (e) => {
    if (!popup.contains(e.target) && !accountBtn.contains(e.target)) {
        popup.classList.add("hidden");
    }
});

// ===============================
//  OUVRIR POPUP DEPUIS LE MENU
// ===============================
document.getElementById("menuAccountBtn").addEventListener("click", () => {
    popup.classList.remove("hidden");
});

// ===============================
//  DÉCONNEXION
// ===============================
document.getElementById("logoutBtnPopup").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

document.getElementById("logoutBtnMenu").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});
