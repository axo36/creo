import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabase = createClient(
    "https://mpnfvrizbluhhjcfzztc.supabase.co",
    "sb_publishable_PMOkki7SEbuv11glUpmNTQ_7KTnMrEr"
);

// Vérification de session
const { data } = await supabase.auth.getSession();

if (!data.session) {
    window.location.href = "index.html";
}

const user = data.session.user;

// Affiche l’email dans le menu
document.getElementById("userEmail").textContent = user.email;

// Ouvre / ferme le menu
const accountBtn = document.getElementById("accountBtn");
const dropdown = document.getElementById("accountDropdown");

accountBtn.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
});

// Déconnexion (menu)
document.getElementById("logoutBtn2").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

// Déconnexion (menu latéral)
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});
