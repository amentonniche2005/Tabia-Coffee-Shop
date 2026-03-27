// ========== VARIABLES GLOBALES ==========
let intervalle = null;
let filtreActuel = "all";
let commandesComptoirCache = [];
let tempsPreparation = {};
let intervalleTemps = null;
let dernierEtatCommandes = '';  // Pour stocker l'état précédent des commandes

// ========== CHARGEMENT ==========
document.addEventListener("DOMContentLoaded", function() {
    console.log("🚀 Page comptoir améliorée chargée");
    
    // Initialiser le stockage si nécessaire
    if (!localStorage.getItem('tabia_commandes_clients')) {
        localStorage.setItem('tabia_commandes_clients', JSON.stringify([]));
        console.log("📦 Initialisation du stockage des commandes");
    }
    
    // Initialiser le stockage des commandes payées si nécessaire
    if (!localStorage.getItem('tabia_commandes_payees')) {
        localStorage.setItem('tabia_commandes_payees', JSON.stringify([]));
    }
    
    // Charger les commandes une seule fois au chargement
    chargerCommandes();
    calculerCAJour();
    
    // Sauvegarder l'état initial pour détecter les nouvelles commandes
    sauvegarderEtatCommandes();
    
    // Écouter UNIQUEMENT les événements storage
    window.addEventListener('storage', function(e) {
        if (e.key === 'tabia_commandes_clients') {
            // Vérifier si c'est une NOUVELLE commande (pas un changement de statut)
            const ancienEtat = dernierEtatCommandes;
            const nouvelEtat = e.newValue;
            
            if (ancienEtat !== nouvelEtat && nouvelEtat) {
                try {
                    const anciennesCommandes = ancienEtat ? JSON.parse(ancienEtat) : [];
                    const nouvellesCommandes = JSON.parse(nouvelEtat);
                    
                    // Identifier les NOUVELLES commandes (celles qui n'existaient pas avant)
                    const idsAnciennes = new Set(anciennesCommandes.map(c => c.id));
                    const nouvellesCommandesAjoutees = nouvellesCommandes.filter(c => 
                        !idsAnciennes.has(c.id) && 
                        c.statut === 'en_attente' && 
                        c.articles && 
                        c.articles.length > 0
                    );
                    
                    // Recharger les commandes
                    chargerCommandes();
                    calculerCAJour();
                    
                    // Jouer le son et afficher la notification SEULEMENT pour les nouvelles commandes
                    if (nouvellesCommandesAjoutees.length > 0) {
                        console.log(`📢 ${nouvellesCommandesAjoutees.length} nouvelle(s) commande(s) détectée(s)`);
                        jouerNotificationSonore();
                        
                        // Message personnalisé
                        if (nouvellesCommandesAjoutees.length === 1) {
                            const cmd = nouvellesCommandesAjoutees[0];
                            const tableInfo = cmd.numeroTable ? ` (Table ${cmd.numeroTable})` : "";
                            afficherNotification(`📢 Nouvelle commande #${cmd.numero}${tableInfo}`, "success");
                        } else {
                            afficherNotification(`📢 ${nouvellesCommandesAjoutees.length} nouvelles commandes reçues !`, "success");
                        }
                    }
                    
                    // Mettre à jour l'état sauvegardé
                    dernierEtatCommandes = nouvelEtat;
                    
                } catch (error) {
                    console.error("Erreur lors de la détection des nouvelles commandes:", error);
                    // Fallback: recharger sans notification
                    chargerCommandes();
                    calculerCAJour();
                    dernierEtatCommandes = nouvelEtat;
                }
            } else {
                // Pas de notification pour les changements de statut
                chargerCommandes();
                calculerCAJour();
            }
        }
        if (e.key === 'tabia_commandes_payees') {
            chargerCommandes();
        }
    });
    
    // Démarrer le compteur de temps pour les commandes en préparation
    demarrerSuiviTemps();
    
    console.log("✅ Comptoir prêt - Notifications uniquement pour les NOUVELLES commandes");
});

// Fonction pour sauvegarder l'état initial des commandes
function sauvegarderEtatCommandes() {
    try {
        const stored = localStorage.getItem('tabia_commandes_clients');
        if (stored) {
            dernierEtatCommandes = stored;
        } else {
            dernierEtatCommandes = JSON.stringify([]);
        }
    } catch (e) {
        dernierEtatCommandes = JSON.stringify([]);
    }
}

// ========== FONCTION PRINCIPALE : CHARGER LES COMMANDES ==========
function chargerCommandes() {
    console.log("📋 Chargement des commandes depuis localStorage...");
    
    // Garder la position de scroll actuelle avant rechargement
    const containers = {
        attente: document.getElementById("commandesAttente"),
        preparation: document.getElementById("commandesPreparation"),
        terminees: document.getElementById("commandesTerminees")
    };
    
    // Sauvegarder les positions de scroll
    const scrollPositions = {
        attente: containers.attente ? containers.attente.scrollTop : 0,
        preparation: containers.preparation ? containers.preparation.scrollTop : 0,
        terminees: containers.terminees ? containers.terminees.scrollTop : 0
    };
    
    // Lire directement depuis localStorage
    let toutes = [];
    try {
        const stored = localStorage.getItem('tabia_commandes_clients');
        if (stored) {
            const toutesLesCommandes = JSON.parse(stored);
            
            // Filtrer pour n'afficher que les commandes non payées et avec des articles
            toutes = toutesLesCommandes.filter(cmd => 
                cmd.statut !== 'paye' && 
                cmd.articles && 
                cmd.articles.length > 0
            );
        }
    } catch (error) {
        console.error("❌ Erreur lors du chargement:", error);
        toutes = [];
    }
    
    commandesComptoirCache = toutes;
    
    // Séparer par statut
    let enAttente = [];
    let enPreparation = [];
    let terminees = [];
    
    for (let i = 0; i < toutes.length; i++) {
        const cmd = toutes[i];
        
        // Ajouter le timestamp si absent
        if (!cmd.timestampCreation) {
            cmd.timestampCreation = cmd.timestamp || cmd.dateTimestamp || Date.now();
        }
        
        if (cmd.statut === "en_attente") {
            enAttente.push(cmd);
        } else if (cmd.statut === "en_preparation") {
            enPreparation.push(cmd);
        } else if (cmd.statut === "terminee") {
            terminees.push(cmd);
        }
    }
    
    // Trier par ordre d'arrivée
    enAttente.sort((a, b) => (a.timestampCreation || 0) - (b.timestampCreation || 0));
    enPreparation.sort((a, b) => (a.timestampCreation || 0) - (b.timestampCreation || 0));
    terminees.sort((a, b) => (b.timestampCreation || 0) - (a.timestampCreation || 0));
    
    // Appliquer les filtres
    if (filtreActuel !== "all") {
        enAttente = enAttente.filter(cmd => {
            if (filtreActuel === "client") return cmd.clientId || cmd.type === "client";
            if (filtreActuel === "comptoir") return !cmd.clientId && cmd.type !== "client";
            return true;
        });
        enPreparation = enPreparation.filter(cmd => {
            if (filtreActuel === "client") return cmd.clientId || cmd.type === "client";
            if (filtreActuel === "comptoir") return !cmd.clientId && cmd.type !== "client";
            return true;
        });
        terminees = terminees.filter(cmd => {
            if (filtreActuel === "client") return cmd.clientId || cmd.type === "client";
            if (filtreActuel === "comptoir") return !cmd.clientId && cmd.type !== "client";
            return true;
        });
    }
    
    // Afficher
    afficherColonne("commandesAttente", enAttente, "attente");
    afficherColonne("commandesPreparation", enPreparation, "preparation");
    afficherColonne("commandesTerminees", terminees, "terminee");
    
    // Restaurer les positions de scroll
    setTimeout(() => {
        if (containers.attente) containers.attente.scrollTop = scrollPositions.attente;
        if (containers.preparation) containers.preparation.scrollTop = scrollPositions.preparation;
        if (containers.terminees) containers.terminees.scrollTop = scrollPositions.terminees;
    }, 50);
    
    // Mettre à jour les stats
    const nbAttenteElem = document.getElementById("nbAttente");
    const nbPreparationElem = document.getElementById("nbPreparation");
    const nbTermineesElem = document.getElementById("nbTerminees");
    
    if (nbAttenteElem) nbAttenteElem.textContent = enAttente.length;
    if (nbPreparationElem) nbPreparationElem.textContent = enPreparation.length;
    if (nbTermineesElem) nbTermineesElem.textContent = terminees.length;
}

// Le reste du code reste identique...
// (gardez toutes les autres fonctions comme elles étaient)

function afficherColonne(containerId, commandes, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (commandes.length === 0) {
        container.innerHTML = "<p class='empty-message'>✨ Aucune commande</p>";
        return;
    }
    
    let html = "";
    for (let i = 0; i < commandes.length; i++) {
        const cmd = commandes[i];
        
        // Déterminer le type d'affichage
        let typeAffichage = "📱 Client";
        if (!cmd.clientId) typeAffichage = "🏪 Comptoir";
        
        html += `
            <div class="commande-card" data-id="${cmd.id}">
                <div class="commande-header">
                    <span class="commande-numero">#${cmd.numero}</span>
                    <div class="badge-container">
                        ${cmd.numeroTable ? `<span class="table-badge">Table ${cmd.numeroTable}</span>` : ""}
                        <span class="client-badge">${typeAffichage}</span>
                    </div>
                </div>
                <div>📅 ${cmd.date || new Date(cmd.timestampCreation).toLocaleString()}</div>
                <div class="commande-articles">
                    ${afficherArticlesAvecPrix(cmd.articles)}
                </div>
                <div class="commande-total">💰 Total: ${(cmd.total || calculerTotalCommande(cmd.articles)).toFixed(2)} DT</div>
                <div class="commande-actions">
                    ${getBoutonsAction(cmd, type)}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Ajouter les écouteurs pour les clics sur les cartes
    document.querySelectorAll('.commande-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            const id = parseInt(card.dataset.id);
            voirDetails(id);
        });
    });
}

function calculerTotalCommande(articles) {
    if (!articles) return 0;
    return articles.reduce((sum, a) => sum + ((a.prix || 0) * (a.quantite || 1)), 0);
}

function afficherArticlesAvecPrix(articles) {
    if (!articles || articles.length === 0) return "<div>Aucun article</div>";
    
    let html = "";
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const prix = article.prix || 0;
        const quantite = article.quantite || 1;
        html += `<div>🍽️ ${quantite}x ${article.nom} - ${(prix * quantite).toFixed(2)} DT</div>`;
    }
    return html;
}

function getBoutonsAction(commande, type) {
    if (type === "attente") {
        return `
            <button class="btn-preparer" onclick="event.stopPropagation(); demarrerPreparation(${commande.id})">
                👨‍🍳 Préparer
            </button>
        `;
    } else if (type === "preparation") {
        return `
            <button class="btn-terminer" onclick="event.stopPropagation(); terminerCommande(${commande.id})">
                ✅ Terminer
            </button>
        `;
    } else {
        return `
            <button class="btn-terminer" onclick="event.stopPropagation(); supprimerCommande(${commande.id})">
                🗑️ Supprimer
            </button>
        `;
    }
}

function demarrerSuiviTemps() {
    if (intervalleTemps) clearInterval(intervalleTemps);
    intervalleTemps = setInterval(() => {
        // Ne fait rien, juste pour garder la structure
    }, 60000);
}

// ========== ACTIONS ==========
async function demarrerPreparation(id) {
    if (confirm("🍳 Démarrer la préparation de cette commande ?")) {
        try {
            const stored = localStorage.getItem('tabia_commandes_clients');
            if (stored) {
                let commandes = JSON.parse(stored);
                const index = commandes.findIndex(c => c.id === id);
                if (index !== -1) {
                    commandes[index].statut = "en_preparation";
                    localStorage.setItem('tabia_commandes_clients', JSON.stringify(commandes));
                    tempsPreparation[id] = Date.now();
                    chargerCommandes();
                    synchroniserAvecClient(); // Synchroniser avec le client
                    afficherNotification("✅ Préparation démarrée !", "success");
                    
                    window.dispatchEvent(new StorageEvent('storage', {
                        key: 'tabia_commandes_clients',
                        newValue: JSON.stringify(commandes)
                    }));
                }
            }
        } catch (error) {
            console.error(error);
            afficherNotification("❌ Erreur", "error");
        }
    }
}

async function terminerCommande(id) {
    if (confirm("✅ Terminer cette commande ?")) {
        try {
            const stored = localStorage.getItem('tabia_commandes_clients');
            if (stored) {
                let commandes = JSON.parse(stored);
                const index = commandes.findIndex(c => c.id === id);
                if (index !== -1) {
                    commandes[index].statut = "terminee";
                    localStorage.setItem('tabia_commandes_clients', JSON.stringify(commandes));
                    delete tempsPreparation[id];
                    chargerCommandes();
                    calculerCAJour();
                    synchroniserAvecClient(); // Synchroniser avec le client
                    afficherNotification("🎉 Commande terminée !", "success");
                    
                    window.dispatchEvent(new StorageEvent('storage', {
                        key: 'tabia_commandes_clients',
                        newValue: JSON.stringify(commandes)
                    }));
                }
            }
        } catch (error) {
            console.error(error);
            afficherNotification("❌ Erreur", "error");
        }
    }
}

async function supprimerCommande(id) {
    if (confirm("⚠️ Supprimer cette commande ?")) {
        try {
            const stored = localStorage.getItem('tabia_commandes_clients');
            if (stored) {
                let commandes = JSON.parse(stored);
                commandes = commandes.filter(c => c.id !== id);
                localStorage.setItem('tabia_commandes_clients', JSON.stringify(commandes));
                chargerCommandes();
                calculerCAJour();
                afficherNotification("🗑️ Commande supprimée", "info");
                
                window.dispatchEvent(new StorageEvent('storage', {
                    key: 'tabia_commandes_clients',
                    newValue: JSON.stringify(commandes)
                }));
            }
        } catch (error) {
            console.error(error);
            afficherNotification("❌ Erreur", "error");
        }
    }
}

function voirDetails(id) {
    const stored = localStorage.getItem('tabia_commandes_clients');
    if (!stored) return;
    
    const commandes = JSON.parse(stored);
    const commande = commandes.find(c => c.id === id);
    if (!commande) return;
    
    const modal = document.getElementById("modalDetails");
    const modalBody = document.getElementById("modalBody");
    if (!modal || !modalBody) return;
    
    const articlesHtml = commande.articles.map(a => `
        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #eee;">
            <span>${a.quantite || 1}x ${a.nom}</span>
            <span>${((a.prix || 0) * (a.quantite || 1)).toFixed(2)} DT</span>
        </div>
    `).join('');
    
    modalBody.innerHTML = `
        <div style="padding: 1rem 0;">
            <p><strong>📝 Commande #${commande.numero}</strong></p>
            <p><strong>👤 Type:</strong> ${commande.clientId ? "Client en ligne" : "Comptoir"}</p>
            ${commande.numeroTable ? `<p><strong>🪑 Table:</strong> ${commande.numeroTable}</p>` : ""}
            <p><strong>📅 Date:</strong> ${commande.date || new Date(commande.timestamp).toLocaleString()}</p>
            <p><strong>📋 Articles:</strong></p>
            ${articlesHtml}
            <p style="margin-top: 1rem; font-size: 1.2rem;"><strong>💰 Total:</strong> ${(commande.total || calculerTotalCommande(commande.articles)).toFixed(2)} DT</p>
            <p><strong>📊 Statut:</strong> ${getStatutTexte(commande.statut)}</p>
        </div>
    `;
    
    modal.style.display = "flex";
}

function getStatutTexte(statut) {
    const statuts = {
        "en_attente": "⏳ En attente",
        "en_preparation": "🍳 En préparation",
        "terminee": "✅ Terminée",
        "paye": "💰 Payée"
    };
    return statuts[statut] || statut;
}

function fermerModal() {
    const modal = document.getElementById("modalDetails");
    if (modal) modal.style.display = "none";
}

// ========== NOTIFICATIONS ==========
function jouerNotificationSonore() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.3;
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch(e) {}
}

function afficherNotification(msg, type = "info") {
    const notif = document.createElement("div");
    const couleurs = { success: "#27ae60", error: "#e74c3c", warning: "#f39c12", info: "#3498db" };
    notif.textContent = msg;
    notif.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: ${couleurs[type]}; color: white;
        padding: 0.8rem 1.2rem; border-radius: 10px; z-index: 1001; animation: slideInRight 0.3s ease;
        font-weight: bold; box-shadow: 0 5px 15px rgba(0,0,0,0.2); font-size: 0.9rem;
    `;
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.style.animation = "slideOutRight 0.3s ease";
        setTimeout(() => notif.remove(), 300);
    }, 2500);
}

// ========== FILTRES ==========
function changerFiltre(filtre) {
    filtreActuel = filtre;
    const buttons = document.querySelectorAll(".filtre-btn");
    buttons.forEach(btn => btn.classList.remove("active"));
    const activeBtn = Array.from(buttons).find(btn => btn.getAttribute("onclick")?.includes(filtre));
    if (activeBtn) activeBtn.classList.add("active");
    chargerCommandes();
}

function filtrerParStatut(statut) {
    const colonnes = document.querySelectorAll(".colonne");
    const index = statut === "attente" ? 0 : statut === "preparation" ? 1 : 2;
    if (colonnes[index]) colonnes[index].scrollIntoView({ behavior: "smooth" });
}

function trierParPriorite() {
    afficherNotification("⭐ Les commandes urgentes sont marquées", "info");
}

function rafraichirCommandes() {
    chargerCommandes();
    calculerCAJour();
    afficherNotification("🔄 Commandes mises à jour", "info");
}

function calculerCAJour() {
    try {
        const stored = localStorage.getItem('tabia_commandes_payees');
        if (stored) {
            const commandesPayees = JSON.parse(stored);
            const aujourdhui = new Date().toLocaleDateString();
            const commandesAujourdhui = commandesPayees.filter(cmd => {
                const dateCmd = new Date(cmd.timestamp || cmd.dateTimestamp).toLocaleDateString();
                return dateCmd === aujourdhui;
            });
            const ca = commandesAujourdhui.reduce((sum, cmd) => sum + (cmd.total || 0), 0);
            const caElem = document.getElementById("caJour");
            if (caElem) caElem.textContent = ca.toFixed(2);
        }
    } catch(e) {
        console.error("Erreur calcul CA:", e);
    }
}
function synchroniserAvecClient() {
    try {
        // Récupérer toutes les commandes du client depuis localStorage
        const clientsIds = [];
        
        // Parcourir toutes les clés localStorage pour trouver les commandes client
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('tabia_mes_commandes_')) {
                const clientId = key.replace('tabia_mes_commandes_', '');
                clientsIds.push(clientId);
            }
        }
        
        // Récupérer les commandes actuelles
        const stored = localStorage.getItem('tabia_commandes_clients');
        if (!stored) return;
        
        const commandesActuelles = JSON.parse(stored);
        
        // Pour chaque client, mettre à jour ses commandes
        clientsIds.forEach(clientId => {
            const clientKey = `tabia_mes_commandes_${clientId}`;
            const storedClient = localStorage.getItem(clientKey);
            if (storedClient) {
                let commandesClient = JSON.parse(storedClient);
                let modifie = false;
                
                // Mettre à jour le statut de chaque commande du client
                commandesClient = commandesClient.map(cmdClient => {
                    const commandeActuelle = commandesActuelles.find(c => c.id === cmdClient.id);
                    if (commandeActuelle && commandeActuelle.statut !== cmdClient.statut) {
                        modifie = true;
                        return { ...cmdClient, statut: commandeActuelle.statut };
                    }
                    return cmdClient;
                });
                
                if (modifie) {
                    localStorage.setItem(clientKey, JSON.stringify(commandesClient));
                    console.log(`📢 Statuts synchronisés pour le client ${clientId}`);
                }
            }
        });
    } catch (error) {
        console.error("Erreur synchronisation client:", error);
    }
}

// ========== EXPORT ==========
window.demarrerPreparation = demarrerPreparation;
window.terminerCommande = terminerCommande;
window.supprimerCommande = supprimerCommande;
window.voirDetails = voirDetails;
window.fermerModal = fermerModal;
window.rafraichirCommandes = rafraichirCommandes;
window.changerFiltre = changerFiltre;
window.filtrerParStatut = filtrerParStatut;
window.trierParPriorite = trierParPriorite;

window.addEventListener("beforeunload", () => {
    if (intervalleTemps) clearInterval(intervalleTemps);
});

console.log("✅ comptoir.js chargé - Notifications UNIQUEMENT pour les NOUVELLES commandes");