import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabase = createClient(
  "https://tjiqssgrxvxnjqhewtrt.supabase.co",
  "sb_publishable_IUb-C1nf11c98QajH_MTVw_8ZQGhMWp"
);

// Si déjà connecté → accès direct
supabase.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = "./client.html";
});

// Connexion email/password
document.getElementById("loginBtn").onclick = async () => {
  const emailValue = document.getElementById("email").value.trim();
  const passValue = document.getElementById("password").value.trim();

  if (!emailValue || !passValue) {
    alert("Veuillez remplir tous les champs.");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailValue,
    password: passValue
  });

  if (error) {
    const msg = error.message;

    if (msg.includes("Invalid login credentials")) {
      alert("Email ou mot de passe incorrect.");
    }
    else if (msg.includes("Email not confirmed")) {
      alert("Votre email n'est pas confirmé.");
    }
    else {
      alert("Impossible de se connecter. Réessayez.");
    }
    return;
  }

  window.location.href = "./client.html";
};

// Google
document.getElementById("googleBtn").onclick = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://axo36.github.io/filey/client.html"
    }
  });
};

// GitHub
document.getElementById("githubBtn").onclick = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: "https://axo36.github.io/filey/client.html"
    }
  });
};
