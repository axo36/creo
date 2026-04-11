document.addEventListener("DOMContentLoaded", () => {
  const navItems = document.querySelectorAll(".nav-item");
  const views = document.querySelectorAll(".view");
  const viewTitle = document.getElementById("view-title");

  const titles = {
    transferts: "Transferts récents",
    appareils: "Appareils",
    fichiers: "Fichiers",
    sync: "Sync",
    parametres: "Paramètres",
    analytiques: "Analytiques",
  };

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-view");

      navItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      views.forEach((v) => v.classList.remove("view-active"));
      const targetView = document.getElementById(`view-${target}`);
      if (targetView) targetView.classList.add("view-active");

      if (titles[target]) viewTitle.textContent = titles[target];
    });
  });
});
