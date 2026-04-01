import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabase = createClient(
    "https://mpnfvrizbluhhjcfzztc.supabase.co",
    "sb-publishable_PM0kkir75Ebuvi1gUlpmNTQ_7KTnMrEr"
);

// Vérification session
const { data } = await supabase.auth.getSession();
if (!data.session) window.location.href = "index.html";

const user = data.session.user;

// Avatar auto-généré
const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`;

// Remplir UI
document.getElementById("avatarIcon").src = avatarUrl;
document.getElementById("popupAvatar").src = avatarUrl;
document.getElementById("popupEmail").textContent = user.email;
document.getElementById("popupUsername").textContent = user.email.split("@")[0];

// Gestion du dropdown
const dropdown = document.getElementById("accountDropdown");
const accountBtn = document.getElementById("accountBtn");

accountBtn.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
});

// Fermer si on clique dehors
document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && !accountBtn.contains(e.target)) {
        dropdown.classList.add("hidden");
    }
});

// Déconnexion depuis le dropdown
document.getElementById("logoutBtnDropdown").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

// (optionnel) si tu gardes un bouton déconnexion dans le menu latéral
const logoutMenu = document.getElementById("logoutBtnMenu");
if (logoutMenu) {
    logoutMenu.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "index.html";
    });
}
