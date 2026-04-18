// ================================================
// MENU
// ================================================

const openBtn = document.getElementById("openBtn");
const closeBtn = document.getElementById("closeBtn");
const menu = document.getElementById("sideMenu");

function updateMenuState() {
    if (window.innerWidth > 768) {
        menu.classList.add("open");
        document.body.classList.add("menu-open");
    } else {
        menu.classList.remove("open");
        document.body.classList.remove("menu-open");
    }
}

updateMenuState();
window.addEventListener("resize", updateMenuState);

openBtn.addEventListener("click", () => {
    menu.classList.add("open");
    if (window.innerWidth > 768) document.body.classList.add("menu-open");
});

closeBtn.addEventListener("click", () => {
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
});

document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768) {
        if (!menu.contains(e.target) && e.target !== openBtn) {
            menu.classList.remove("open");
        }
    }
});

// ================================================
// CLIENTS
// ================================================

const SUPABASE_URL = "https://tjiqssgrxvxnjqhewtrt.supabase.co";
const SUPABASE_KEY = "sb_publishable_IUb-C1nf11c98QajH_MTVw_8ZQGhMWp";

let allClients = [];
let currentMode = null; // "mobile" ou "desktop"

// Vérifier si client en ligne
function isClientOnline(lastSeen) {
    const now = Date.now();
    const lastSeenTime = new Date(lastSeen).getTime();
    return (now - lastSeenTime) / 1000 < 30;
}

// ================================================
// MODE RESPONSIVE GLOBAL
// ================================================
function detectMode() {
    return window.innerWidth > 400 ? "desktop" : "mobile";
}

function updateDisplayMode() {
    const newMode = detectMode();

    if (newMode !== currentMode) {
        currentMode = newMode;
        renderClients(allClients); // 🔥 recrée UNIQUEMENT si le mode change
    }
}

window.addEventListener("resize", updateDisplayMode);

// ================================================
// CHARGEMENT DES CLIENTS
// ================================================
async function loadClients() {
    try {
        const clientsUrl = `${SUPABASE_URL}/rest/v1/clients?select=*&order=id.desc`;
        const response = await fetch(clientsUrl, {
            headers: {
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "apikey": SUPABASE_KEY
            }
        });

        allClients = await response.json();

        for (let client of allClients) {
            const usbUrl = `${SUPABASE_URL}/rest/v1/usb_history?client_code=eq.${client.code}&order=last_seen.desc&limit=3`;
            try {
                const usbRes = await fetch(usbUrl, {
                    headers: {
                        "Authorization": `Bearer ${SUPABASE_KEY}`,
                        "apikey": SUPABASE_KEY
                    }
                });
                client.usb_history = await usbRes.json();
            } catch {
                client.usb_history = [];
            }
        }

        if (!currentMode) {
            currentMode = detectMode();
            renderClients(allClients); // 🔥 première création
        } else {
            updateClients(allClients); // 🔥 mise à jour sans recréer
        }

    } catch (err) {
        console.error("Erreur chargement clients:", err);
    }
}

// ================================================
// CRÉATION DES CARTES (UNE FOIS PAR MODE)
// ================================================
function renderClients(clients) {
    const container = document.getElementById("clientsContainer");
    container.innerHTML = "";

    const isMobile = currentMode === "mobile";

    clients.forEach(client => {
        const card = document.createElement("div");
        card.className = "client-card";
        card.id = `client-${client.code}`;

        card.innerHTML = isMobile ? mobileTemplate(client) : desktopTemplate(client);

        container.appendChild(card);
    });

    updateClients(clients);
}

// ================================================
// TEMPLATES
// ================================================
function mobileTemplate(client) {
    return `
        <div class="texm-client">
            <div class="flexm">
                <div class="client-status">
                    <span class="status-dot"></span>
                    <span class="client-code">${client.code}</span>
                </div>
                <a class="fleche">></a>
            </div>

            <div class="client-info">
                <div class="client-info-line user"></div>
                <div class="client-info-line ip"></div>
            </div>

            <div class="usb-list"></div>
        </div>

        <div class="img-client">
            <img class="client-screenshot" />
        </div>
    `;
}

function desktopTemplate(client) {
    return `
        <div class="texm-client">
            <div class="client-status">
                <span class="status-dot"></span>
                <span class="client-code">${client.code}</span>
            </div>

            <div class="client-info">
                <div class="client-info-line user"></div>
                <div class="client-info-line ip"></div>
            </div>

            <div class="usb-list"></div>
        </div>

        <div class="img-client">
            <a class="fleche">></a>
            <img class="client-screenshot" />
        </div>
    `;
}

// ================================================
// MISE À JOUR SANS RECRÉER
// ================================================
function updateClients(clients) {
    clients.forEach(client => {
        const card = document.getElementById(`client-${client.code}`);
        if (!card) return;

        const online = isClientOnline(client.last_seen);

        card.classList.toggle("offline", !online);
        card.querySelector(".status-dot").classList.toggle("offline", !online);

        card.querySelector(".user").textContent = `User: ${client.username || "N/A"}`;
        card.querySelector(".ip").textContent = `IP: ${client.ip_local || "N/A"}`;

        const usbList = card.querySelector(".usb-list");
        usbList.innerHTML = `<div class="usb-title">USB :</div>` +
            (client.usb_history?.length
                ? client.usb_history.map(u => `<div class="usb-item">${u.volume_name}</div>`).join("")
                : `<div class="usb-item" style="color:#666;">Aucune clé détectée</div>`
            );

        const img = card.querySelector(".client-screenshot");
        if (client.screenshot_url) {
            const newUrl = `${client.screenshot_url}?t=${Date.now()}`;
            if (img.src !== newUrl) img.src = newUrl;
        }
    });
}

// ================================================
// RECHERCHE
// ================================================
const searchInput = document.getElementById("searchInput");
if (searchInput) {
    searchInput.addEventListener("input", () => {
        const term = searchInput.value.toLowerCase();
        const filtered = allClients.filter(c =>
            c.code.toLowerCase().includes(term) ||
            (c.username && c.username.toLowerCase().includes(term))
        );
        renderClients(filtered);
    });
}

// ================================================
// INIT
// ================================================
loadClients();
setInterval(loadClients, 5000);
