const openBtn = document.getElementById("openBtn");
const closeBtn = document.getElementById("closeBtn");
const menu = document.getElementById("sideMenu");

// Fonction pour mettre le menu dans le bon état selon la taille
function updateMenuState() {
    if (window.innerWidth > 768) {
        // Mode ORDINATEUR
        menu.classList.add("open");
        document.body.classList.add("menu-open");
    } else {
        // Mode TÉLÉPHONE
        menu.classList.remove("open");
        document.body.classList.remove("menu-open");
    }
}

// Appel au chargement
updateMenuState();

// Appel quand on change la taille de la fenêtre
window.addEventListener("resize", updateMenuState);

// OUVRIR (PC + mobile)
openBtn.addEventListener("click", () => {
    menu.classList.add("open");

    if (window.innerWidth > 768) {
        document.body.classList.add("menu-open");
    }
});

// FERMER (PC + mobile)
closeBtn.addEventListener("click", () => {
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
});

// MOBILE : fermer en cliquant ailleurs
document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768) {
        if (!menu.contains(e.target) && e.target !== openBtn) {
            menu.classList.remove("open");
        }
    }
});

// ================================================
// GESTION DES CLIENTS
// ================================================

const SUPABASE_URL = "https://tjiqssgrxvxnjqhewtrt.supabase.co";
const SUPABASE_KEY = "sb_publishable_IUb-C1nf11c98QajH_MTVw_8ZQGhMWp";

let allClients = [];

// Vérifier si client en ligne
function isClientOnline(lastSeen) {
    const now = Date.now();
    const lastSeenTime = new Date(lastSeen).getTime();
    const diffSeconds = (now - lastSeenTime) / 1000;
    return diffSeconds < 30;
}

// Charger les clients depuis Supabase
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
        
        // Charger l'historique USB pour chaque client
        for (let client of allClients) {
            const usbHistoryUrl = `${SUPABASE_URL}/rest/v1/usb_history?client_code=eq.${client.code}&order=last_seen.desc&limit=3`;
            try {
                const usbResponse = await fetch(usbHistoryUrl, {
                    headers: {
                        "Authorization": `Bearer ${SUPABASE_KEY}`,
                        "apikey": SUPABASE_KEY
                    }
                });
                client.usb_history = await usbResponse.json();
            } catch (e) {
                client.usb_history = [];
            }
        }
        
        displayClients(allClients);
    } catch (error) {
        console.error("Erreur chargement clients:", error);
        document.getElementById('clientsContainer').innerHTML = 
            '<div class="empty">❌ Erreur de chargement des clients</div>';
    }
}

// Afficher les clients
function displayClients(clients) {
    const container = document.getElementById('clientsContainer');

    if (!clients || clients.length === 0) {
        container.innerHTML = '<div class="empty">Aucun client connecté</div>';
        return;
    }

    // VERSION DESKTOP
    if (window.innerWidth < 400) {

        const items = clients.map(client => {
            const online = isClientOnline(client.last_seen);

            // 🔥 IMPORTANT : définir usbSection ici
            let usbSection = `
                <div class="usb-list">
                    <div class="usb-title">USB :</div>
            `;

            if (client.usb_history?.length > 0) {
                usbSection += client.usb_history.map(usb => {
                    return `<div class="usb-item">${usb.volume_name}</div>`;
                }).join('');
            } else {
                usbSection += `<div class="usb-item" style="color:#666;">Aucune clé détectée</div>`;
            }

            usbSection += `</div>`;


            return `
                <div class="client-card ${!online ? 'offline' : ''}">
                    <div class="texm-client">
                        <div class="flexm">
                            <div class="client-status">
                                <span class="status-dot ${!online ? 'offline' : ''}"></span>
                                <span class="client-code">${client.code}</span>
                            </div>
                            <a class="fleche">></a>
                        </div>

                        <div class="client-info">
                            <div class="client-info-line">User: ${client.username || 'N/A'}</div>
                            <div class="client-info-line">Ip: ${client.ip_local || 'N/A'}</div>
                        </div>

                        ${usbSection}
                    </div>

                    <div class="img-client">
                        ${client.screenshot_url ? `<img src="${client.screenshot_url}?t=${Date.now()}" class="client-screenshot">` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = items;
        return;
    }

    // VERSION MOBILE
    const items = clients.map(client => {
        const online = isClientOnline(client.last_seen);

        // 🔥 IMPORTANT : définir usbSection ici aussi
        let usbSection = `
            <div class="usb-list">
                <div class="usb-title">USB :</div>
        `;

        if (client.usb_history?.length > 0) {
            usbSection += client.usb_history.map(usb => {
                return `<div class="usb-item">${usb.volume_name}</div>`;
            }).join('');
        } else {
            usbSection += `<div class="usb-item" style="color:#666;">Aucune clé détectée</div>`;
        }

        usbSection += `</div>`;


        return `
            <div class="client-card ${!online ? 'offline' : ''}">
                <div class="texm-client">
                    <div class="client-status">
                        <span class="status-dot ${!online ? 'offline' : ''}"></span>
                        <span class="client-code">${client.code}</span>
                    </div>

                    <div class="client-info">
                        <div class="client-info-line">User: ${client.username || 'N/A'}</div>
                        <div class="client-info-line">Ip: ${client.ip_local || 'N/A'}</div>
                    </div>

                    ${usbSection}
                </div>

                <div class="img-client">
                    <a class="fleche">></a>
                    ${client.screenshot_url ? `<img src="${client.screenshot_url}?t=${Date.now()}" class="client-screenshot">` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = items;
}


// Recherche de clients
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (!searchTerm) {
            displayClients(allClients);
            return;
        }
        
        const filtered = allClients.filter(client => {
            return client.code.toLowerCase().includes(searchTerm) ||
                   (client.username && client.username.toLowerCase().includes(searchTerm)) ||
                   (client.computer_name && client.computer_name.toLowerCase().includes(searchTerm)) ||
                   (client.nickname && client.nickname.toLowerCase().includes(searchTerm));
        });
        
        displayClients(filtered);
    });
}

// Ouvrir détails client (fonction à implémenter plus tard)
function openClientDetails(clientCode) {
    console.log('Ouvrir détails pour:', clientCode);
    // TODO: Ouvrir modal avec détails
}


// ================================================
// GESTION DES CLIENT SEULON LE SUPORT
// ================================================





// Charger les clients au démarrage
loadClients();

// Recharger toutes les 5 secondes
setInterval(loadClients,5000);
