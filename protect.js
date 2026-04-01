const popup = document.getElementById("accountPopup");
const avatarBtn = document.getElementById("accountBtn");

avatarBtn.addEventListener("click", () => {
    popup.classList.toggle("hidden");
});

// Fermer si on clique ailleurs
document.addEventListener("click", (e) => {
    if (!popup.contains(e.target) && !avatarBtn.contains(e.target)) {
        popup.classList.add("hidden");
    }
});
