/* =========================================================
   auth.js — Authentification + EmailJS (pour login.html)
   Version légère, rapide, sans animations
========================================================= */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { v4 as uuidv4 } from "https://cdn.jsdelivr.net/npm/uuid@9.0.0/dist/esm-browser/index.js";

/* ── SUPABASE ──────────────────────────── */
export const supabase = createClient(
  "https://mpnfvrizbluhhjcfzztc.supabase.co",
  "sb_publishable_PMOkki7SEbuv11glUpmNTQ_7KTnMrEr"
);

/* ── LOGIN ─────────────────────────────── */
export async function emailLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes("Invalid login credentials"))
      return "Email ou mot de passe incorrect.";
    return "Connexion impossible.";
  }

  const user = data.user;
  if (!user) return "Erreur de connexion.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_verified")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.email_verified) {
    await supabase.auth.signOut();
    return "Veuillez confirmer votre email avant de vous connecter.";
  }

  return null;
}

/* ── SIGNUP + EMAILJS ───────────────────── */
export async function emailSignup(email, password, fullName) {

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message, needsConfirm: false };
  if (!data.user) return { error: "Erreur lors de la création du compte.", needsConfirm: false };

  const userId = data.user.id;

  await supabase.from("profiles").upsert({
    id: userId,
    email,
    email_verified: false
  });

  const token = uuidv4();

  await supabase.from("email_verification").upsert({
    user_id: userId,
    token
  });

  emailjs.send("service_cyy74i2", "template_yxhlnzs", {
    email: email,
    name: fullName,
    confirm_link: `${window.location.origin}/verify.html?token=${token}`
  });

  return { error: null, needsConfirm: true };
}

/* ── GOOGLE LOGIN ───────────────────────── */
export async function oauthLogin(provider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + "/index.html" }
  });
  if (error) alert(error.message);
}
