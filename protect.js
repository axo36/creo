import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabase = createClient(
    "https://mpnfvrizbluhhjcfzztc.supabase.co",
    "sb_publishable_PMOkki7SEbuv11glUpmNTQ_7KTnMrEr"
);

// Vérification session
const { data } = await supabase.auth.getSession();
if (!data.session) window.location.href = "index.html";

const user = data.session.user;

// Avatar auto-généré
const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`;

// Remplir le popup
document.getElementById("popupAvatar").src = avatarUrl;
document.getElementById("avatarIcon").src = avatarUrl;
document.getElementById("popupEmail").textContent = user.email;
document.getElementById("popupUsername").textContent = user.email.split("@")[0];

// Ouvrir / fermer popup
const popup = document.getElementById("accountPopup");
document.getElementById("avatarIcon").addEventListener("click", () => {
    popup.classList.toggle("hidden");
});

// Déconnexion (popup)
document.getElementById("logoutBtnPopup").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

// Déconnexion (menu latéral)
document.getElementById("logoutBtnMenu").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

// Ouvrir popup depuis le menu latéral
document.getElementById("menuAccountBtn").addEventListener("click", () => {
    popup.classList.remove("hidden");
});
