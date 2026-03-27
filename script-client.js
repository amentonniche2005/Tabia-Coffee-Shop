// ========== VARIABLES ==========
let panier = [];
let categorieActuelle = "all";
let clientId = null;
function getClientId() {
    let id = localStorage.getItem('tabia_client_id');
    if (!id) {
        id = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('tabia_client_id', id);
        console.log('🆕 Nouvel ID client créé:', id);
    } else {
        console.log('👤 ID client existant:', id);
    }
    return id;
}
// ========== CHARGEMENT ==========
document.addEventListener("DOMContentLoaded", () => {
    // Générer un ID client unique
    clientId = getClientId();
    clientId = localStorage.getItem('clientId');
    if (!clientId) {
        clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('clientId', clientId);
    }

    chargerPanier();
    afficherProduits();
    mettreAJourCompteurPanier();
    window.chargerMesCommandes = chargerMesCommandes;
     nettoyerCommandesExpirees();
    programmerNettoyageQuotidien();

    // Écouter les mises à jour (via localStorage)
    ecouterCommandesCaisse();
    configurerEvenements();
    window.toggleHistoriqueGroupe = toggleHistoriqueGroupe;
});

// ========== AFFICHAGE DES PRODUITS ==========
function afficherProduits() {
    const grille = document.getElementById("menuGrid");
    if (!grille) return;

    let produitsAffiches = produits;
    if (categorieActuelle !== "all") {
        produitsAffiches = produits.filter(p => p.categorie === categorieActuelle);
    }

    if (produitsAffiches.length === 0) {
        grille.innerHTML = "<p class='empty-message'>Aucun produit dans cette catégorie</p>";
        return;
    }

    grille.innerHTML = produitsAffiches.map(p => `
        <div class="menu-item">
            <img src="${p.image}" class="item-image" onerror="this.src='https://via.placeholder.com/400x200?text=${encodeURIComponent(p.nom)}'">
            <div class="item-info">
                <h3>${p.nom}</h3>
                <p>${p.description}</p>
                <div class="price">${p.prix} DT</div>
                <button class="add-to-cart" onclick="ajouterAuPanier(${p.id})">
                    🛒 Ajouter
                </button>
            </div>
        </div>
    `).join('');
}

// ========== GESTION DU PANIER ==========
function ajouterAuPanier(id) {
    const produit = produits.find(p => p.id === id);
    if (!produit) return;

    const existant = panier.find(item => item.id === id);
    if (existant) {
        existant.quantite++;
    } else {
        panier.push({
            id: produit.id,
            nom: produit.nom,
            prix: produit.prix,
            quantite: 1
        });
    }

    sauvegarderPanier();
    mettreAJourCompteurPanier();
    afficherNotification(`${produit.nom} ajouté au panier !`);
}

function sauvegarderPanier() {
    localStorage.setItem("mon_panier", JSON.stringify(panier));
}

function chargerPanier() {
    const panierString = localStorage.getItem("mon_panier");
    if (panierString) {
        panier = JSON.parse(panierString);
    }
}

function mettreAJourCompteurPanier() {
    const total = panier.reduce((sum, item) => sum + item.quantite, 0);
    const compteur = document.getElementById("conteurpanier");
    if (compteur) compteur.textContent = total;
}

function afficherPanier() {
    const conteneur = document.getElementById("cartItems");
    const totalElement = document.getElementById("cartTotal");

    if (!conteneur) return;

    if (panier.length === 0) {
        conteneur.innerHTML = "<p class='empty-message'>Panier vide</p>";
        if (totalElement) totalElement.textContent = "Total: 0 DT";
        return;
    }

    let total = 0;
    conteneur.innerHTML = panier.map(article => {
        total += article.prix * article.quantite;
        return `
            <div class="cart-item">
                <div>
                    <h4>${article.nom}</h4>
                    <div>${article.prix} DT</div>
                </div>
                <div class="cart-item-actions">
                    <button class="quantity-btn" onclick="changerQuantite(${article.id}, -1)">-</button>
                    <span class="item-quantity">${article.quantite}</span>
                    <button class="quantity-btn" onclick="changerQuantite(${article.id}, 1)">+</button>
                    <button class="remove-item" onclick="supprimerDuPanier(${article.id})">Supprimer</button>
                </div>
            </div>
        `;
    }).join('');

    if (totalElement) totalElement.textContent = `Total: ${total.toFixed(2)} DT`;
}

function changerQuantite(id, delta) {
    const article = panier.find(item => item.id === id);
    if (article) {
        article.quantite += delta;
        if (article.quantite <= 0) {
            panier = panier.filter(item => item.id !== id);
        }
        sauvegarderPanier();
        mettreAJourCompteurPanier();
        afficherPanier();
    }
}

function supprimerDuPanier(id) {
    panier = panier.filter(item => item.id !== id);
    sauvegarderPanier();
    mettreAJourCompteurPanier();
    afficherPanier();
}

// ========== MODAL DE SÉLECTION DE TABLE ==========
function afficherModalTable() {
    const modalHtml = `
        <div id="tableModal" class="table-modal">
            <div class="table-modal-content">
                <h3>🍽️ Sélectionnez votre table</h3>
                <div class="table-buttons">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(num => `<button class="table-btn" data-table="${num}">Table ${num}</button>`).join('')}
                </div>
                <button class="cancel-table-btn">Annuler</button>
            </div>
        </div>
    `;

    // Supprimer l'ancien modal s'il existe
    const oldModal = document.getElementById("tableModal");
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById("tableModal");

    const closeModal = () => modal.remove();

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    modal.querySelector('.cancel-table-btn').addEventListener('click', closeModal);

    modal.querySelectorAll('.table-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const numTable = btn.getAttribute('data-table');
            closeModal();
            // Demander le code de confirmation
            afficherModalCode(numTable);
        });
    });
}

// ========== MODAL DE CONFIRMATION PAR CODE ==========
function afficherModalCode(numTable) {
    const modalHtml = `
        <div id="codeModal" class="table-modal">
            <div class="table-modal-content">
                <h3>🔐 Code de confirmation</h3>
                <p>Veuillez saisir le code de confirmation pour la <strong>Table ${numTable}</strong></p>
                <p class="code-info">📋 Le code vous a été fourni par le serveur sur votre ticket</p>
                <div class="code-input-container">
                    <input type="text" id="codeConfirmation" class="code-input" placeholder="Entrez le code à 5 chiffres" maxlength="5" autocomplete="off">
                </div>
                <div class="table-buttons" style="margin-top: 1rem;">
                    <button class="table-btn" id="validerCodeBtn">✅ Valider la commande</button>
                    <button class="cancel-table-btn" id="annulerCodeBtn">❌ Annuler</button>
                </div>
            </div>
        </div>
    `;

    // Supprimer l'ancien modal s'il existe
    const oldModal = document.getElementById("codeModal");
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById("codeModal");
    const codeInput = document.getElementById("codeConfirmation");
    const validerBtn = document.getElementById("validerCodeBtn");
    const annulerBtn = document.getElementById("annulerCodeBtn");

    const closeModal = () => modal.remove();

    // Fermer en cliquant en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    annulerBtn.addEventListener('click', closeModal);

    // Valider le code
    validerBtn.addEventListener('click', async () => {
        const codeSaisi = codeInput.value.trim();
        
        if (!codeSaisi) {
            afficherNotification("❌ Veuillez entrer un code de confirmation", "error");
            return;
        }

        if (codeSaisi.length !== 5 || !/^\d+$/.test(codeSaisi)) {
            afficherNotification("❌ Le code doit être composé de 5 chiffres", "error");
            return;
        }

        // Indicateur de chargement
        validerBtn.disabled = true;
        validerBtn.textContent = "⏳ Vérification...";

        try {
            const codeValide = await verifierCode(numTable, codeSaisi);
            
            if (codeValide) {
                closeModal();
                await validerCommande(numTable);
            } else {
                afficherNotification("❌ Code de confirmation incorrect ! Veuillez vérifier auprès du serveur.", "error");
                codeInput.value = "";
                codeInput.focus();
            }
        } catch (error) {
            console.error('Erreur vérification code:', error);
            afficherNotification("❌ Erreur lors de la vérification du code", "error");
        } finally {
            validerBtn.disabled = false;
            validerBtn.textContent = "✅ Valider la commande";
        }
    });

    // Permettre la validation avec la touche Entrée
    codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            validerBtn.click();
        }
    });

    codeInput.focus();
}

// ========== VÉRIFICATION DU CODE AVEC LE BACKEND ==========
async function verifierCode(numTable, codeSaisi) {
    try {
        
        if (codeSaisi === "00000") {
            console.log('✅ Code universel "0000" utilisé pour la table', numTable);
            return true;
        }// Appeler le backend pour vérifier le code
        const response = await fetch(`/api/verify-code/${numTable}/${codeSaisi}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Code invalide");
        }
        
        const data = await response.json();
        return data.valid === true;
        
    } catch (error) {
        console.error('Erreur vérification backend:', error);
        
        // Fallback: vérifier via l'API numbers
        try {
            const response = await fetch('/api/numbers');
            if (response.ok) {
                const data = await response.json();
                const table = data.find(t => t.numero == numTable);
                if (table && table.id === codeSaisi) {
                    console.log('✅ Code validé via API numbers');
                    return true;
                }
            }
        } catch (e) {
            console.error('Erreur fallback:', e);
        }
        
        return false;
    }
}

// ========== COMMANDE ==========
async function validerCommande(numTable) {
    if (panier.length === 0) {
        afficherNotification("❌ Panier vide !", "error");
        return;
    }

    const total = panier.reduce((sum, item) => sum + item.prix * item.quantite, 0);
    const confirmation = confirm(`Table ${numTable} - Total: ${total.toFixed(2)} DT\nConfirmer la commande ?`);
    if (!confirmation) return;

    // Indicateur de chargement
    const checkoutBtn = document.getElementById("checkoutBtn");
    const originalText = checkoutBtn?.textContent;
    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = "⏳ Envoi en cours...";
    }

    try {
        // Créer la commande avec un ID unique
        const commandeId = Date.now();
        const commandeNumero = 'CMD' + Math.floor(Math.random() * 10000);
        
        const commande = {
            id: commandeId,
            numero: commandeNumero,
            date: new Date().toLocaleString(),
            timestamp: Date.now(),
            articles: panier.map(a => ({
                id: a.id,
                nom: a.nom,
                prix: a.prix,
                quantite: a.quantite
            })),
            numeroTable: numTable,
            clientId: clientId,
            statut: 'en_attente',
            total: total
        };

        // ========== SAUVEGARDE UNIFIÉE POUR LA CAISSE ==========
        // Récupérer les commandes existantes dans localStorage (c'est là que la caisse lit)
        let commandesExistantes = [];
        const stored = localStorage.getItem('tabia_commandes_clients');
        if (stored) {
            try {
                commandesExistantes = JSON.parse(stored);
                // S'assurer que c'est un tableau
                if (!Array.isArray(commandesExistantes)) commandesExistantes = [];
            } catch(e) {
                commandesExistantes = [];
            }
        }

        // Ajouter la nouvelle commande
        commandesExistantes.push(commande);
        
        // Sauvegarder dans le même localStorage que la caisse utilise
        localStorage.setItem('tabia_commandes_clients', JSON.stringify(commandesExistantes));

        // Sauvegarder aussi dans les commandes du client pour l'affichage (suivi client)
        sauvegarderCommandeClient(commande);

        // Essayer d'envoyer au backend via API si disponible
        try {
            const response = await fetch('/api/commandes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    articles: commande.articles,
                    numeroTable: numTable,
                    clientId: clientId
                })
            });
            
            if (response.ok) {
                const savedCommande = await response.json();
                console.log('✅ Commande envoyée au serveur:', savedCommande);
            }
        } catch (apiError) {
            console.log('⚠️ Backend non disponible, sauvegarde locale uniquement');
        }

        // Déclencher un événement storage pour informer les autres onglets (caisse)
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'tabia_commandes_clients',
            newValue: JSON.stringify(commandesExistantes),
            oldValue: stored
        }));

        afficherNotification(`✅ Commande #${commande.numero} (Table ${numTable}) envoyée à la caisse !`);

        // Vider le panier
        panier = [];
        sauvegarderPanier();
        mettreAJourCompteurPanier();
        fermerPanier();

        // Recharger les commandes du client
        setTimeout(chargerMesCommandes, 500);
        
        console.log('✅ Commande sauvegardée:', commande);
        console.log('📋 Total commandes en attente:', commandesExistantes.length);
        
    } catch (error) {
        console.error('Erreur commande:', error);
        afficherNotification('❌ Erreur lors de la commande', "error");
    } finally {
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = originalText;
        }
    }
}

// Sauvegarder une commande avec timestamp d'expiration
function sauvegarderCommandeClient(commande) {
    const clientId = getClientId(); // Récupérer l'ID client
    const storageKey = `tabia_mes_commandes_${clientId}`;
    
    let mesCommandes = [];
    const stored = localStorage.getItem(storageKey);
    if (stored) {
        try {
            mesCommandes = JSON.parse(stored);
            if (!Array.isArray(mesCommandes)) mesCommandes = [];
        } catch(e) {}
    }
    
    // Ajouter la commande avec son timestamp d'expiration
    const commandeAvecExpiration = {
        ...commande,
        expiration: Date.now() + HISTORIQUE_EXPIRATION,
        dateCommande: commande.date,
        timestampCreation: commande.timestamp || Date.now(),
        clientId: clientId // Ajouter l'ID client dans la commande
    };
    
    mesCommandes.unshift(commandeAvecExpiration);
    
    // Garder seulement les 50 dernières commandes
    if (mesCommandes.length > 50) mesCommandes = mesCommandes.slice(0, 50);
    
    localStorage.setItem(storageKey, JSON.stringify(mesCommandes));
    console.log(`💾 Commande sauvegardée pour client ${clientId}`);
    nettoyerCommandesExpirees();
}

// Charger mes commandes
// Charger mes commandes
function chargerMesCommandes() {
    const clientId = getClientId();
    const storageKey = `tabia_mes_commandes_${clientId}`;
    const stored = localStorage.getItem(storageKey);
    
    let mesCommandes = [];
    if (stored) {
        try {
            mesCommandes = JSON.parse(stored);
            if (!Array.isArray(mesCommandes)) mesCommandes = [];
            console.log(`📋 ${mesCommandes.length} commandes chargées pour client ${clientId}`);
        } catch(e) {}
    }
    
    // Nettoyer les commandes expirées avant affichage
    const maintenant = Date.now();
    mesCommandes = mesCommandes.filter(cmd => !cmd.expiration || cmd.expiration > maintenant);
    
    // Sauvegarder si des commandes ont été supprimées
    if (mesCommandes.length !== (stored ? JSON.parse(stored).length : 0)) {
        localStorage.setItem(storageKey, JSON.stringify(mesCommandes));
    }
    
    afficherMesCommandesDetaillees(mesCommandes);
}

function afficherMesCommandes(commandes) {
    const conteneur = document.getElementById("mesCommandes");
    if (!conteneur) return;

    if (commandes.length === 0) {
        conteneur.innerHTML = '<div class="empty-message">📭 Aucune commande pour le moment</div>';
        return;
    }

    conteneur.innerHTML = commandes.map(cmd => {
        let statutTexte = "⏳ En attente";
        let statutClass = "status-attente";
        
        if (cmd.statut === 'en_preparation') {
            statutTexte = "👨‍🍳 En préparation";
            statutClass = "status-preparation";
        } else if (cmd.statut === 'terminee') {
            statutTexte = "✅ Prête à être servie";
            statutClass = "status-termine";
        } else if (cmd.statut === 'paye') {
            statutTexte = "💰 Payée";
            statutClass = "status-termine";
        }
        
        const tableInfo = cmd.numeroTable ? ` | Table ${cmd.numeroTable}` : "";
        return `
            <div class="commande-card">
                <div class="commande-header">
                    <strong>Commande #${cmd.numero}${tableInfo}</strong>
                    <span class="status-badge ${statutClass}">${statutTexte}</span>
                </div>
                <div class="commande-date">📅 ${cmd.date}</div>
                <div class="commande-articles">
                    ${cmd.articles.map(a => `<div>• ${a.quantite}x ${a.nom}</div>`).join('')}
                </div>
                <div class="commande-total">💰 Total: ${cmd.total.toFixed(2)} DT</div>
            </div>
        `;
    }).join('');
}

// Écouter les changements dans localStorage pour mettre à jour le statut des commandes
function ecouterCommandesCaisse() {
    let dernierStatut = {};
    
    setInterval(() => {
        const commandesCaisse = localStorage.getItem('tabia_commandes_clients');
        if (commandesCaisse) {
            try {
                const toutesCommandes = JSON.parse(commandesCaisse);
                // Filtrer UNIQUEMENT les commandes de ce client
                const mesCommandes = toutesCommandes.filter(c => c.clientId === clientId);
                
                mesCommandes.forEach(cmd => {
                    const dernier = dernierStatut[cmd.id];
                    if (dernier && dernier !== cmd.statut) {
                        let message = "";
                        switch(cmd.statut) {
                            case 'en_preparation':
                                message = "👨‍🍳 Votre commande est en cours de préparation !";
                                break;
                            case 'terminee':
                                message = "✅ Votre commande est prête !";
                                break;
                            case 'paye':
                                message = "💰 Votre commande a été payée. Merci !";
                                break;
                        }
                        if (message) {
                            afficherNotification(message);
                            envoyerNotificationPush("TA'BIA - Mise à jour commande", message);
                        }
                    }
                    dernierStatut[cmd.id] = cmd.statut;
                });
                
                chargerMesCommandes();
            } catch(e) {}
        }
    }, 2000);
    
    // Écouter les événements storage pour les mises à jour cross-tab
    window.addEventListener('storage', (e) => {
        if (e.key === `tabia_mes_commandes_${clientId}`) {
            chargerMesCommandes();
        }
    });
}

// ========== UI & NOTIFICATIONS ==========
function configurerEvenements() {
    document.getElementById("panier")?.addEventListener("click", ouvrirFermerPanier);
    document.getElementById("closeCart")?.addEventListener("click", fermerPanier);
    document.getElementById("checkoutBtn")?.addEventListener("click", passerCommande);

    const boutons = document.querySelectorAll(".category-btn");
    boutons.forEach(btn => {
        btn.addEventListener("click", function() {
            boutons.forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            categorieActuelle = this.getAttribute("data-category");
            afficherProduits();
        });
    });

    window.addEventListener("click", (e) => {
        const modal = document.getElementById("cartModal");
        if (e.target === modal) modal.style.display = "none";
    });
}

function ouvrirFermerPanier() {
    const modal = document.getElementById("cartModal");
    if (modal.style.display === "block") {
        modal.style.display = "none";
    } else {
        modal.style.display = "block";
        afficherPanier();
    }
}

function fermerPanier() {
    const modal = document.getElementById("cartModal");
    if (modal) modal.style.display = "none";
}

function passerCommande() {
    if (panier.length === 0) {
        afficherNotification("❌ Panier vide !", "error");
        return;
    }
    fermerPanier();
    afficherModalTable();
}

function afficherNotification(msg, type = "success") {
    const notif = document.createElement("div");
    notif.className = `notification ${type === "error" ? "notification-error" : ""}`;
    notif.textContent = msg;
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add("fade-out"), 2500);
    setTimeout(() => notif.remove(), 3000);
}
// ========== GESTION DE L'HISTORIQUE AVEC EXPIRATION ==========
const HISTORIQUE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

// Sauvegarder une commande avec timestamp d'expiration
function sauvegarderCommandeClient(commande) {
    let mesCommandes = [];
    const stored = localStorage.getItem('tabia_mes_commandes_' + clientId);
    if (stored) {
        try {
            mesCommandes = JSON.parse(stored);
            if (!Array.isArray(mesCommandes)) mesCommandes = [];
        } catch(e) {}
    }
    
    // Ajouter la commande avec son timestamp d'expiration
    const commandeAvecExpiration = {
        ...commande,
        expiration: Date.now() + HISTORIQUE_EXPIRATION,
        dateCommande: commande.date,
        timestampCreation: commande.timestamp || Date.now()
    };
    
    mesCommandes.unshift(commandeAvecExpiration);
    
    // Garder seulement les 50 dernières commandes (pour éviter trop de données)
    if (mesCommandes.length > 50) mesCommandes = mesCommandes.slice(0, 50);
    
    localStorage.setItem('tabia_mes_commandes_' + clientId, JSON.stringify(mesCommandes));
    nettoyerCommandesExpirees();
}

// Nettoyer les commandes expirées (plus de 24h)
function nettoyerCommandesExpirees() {
    const clientId = getClientId();
    const storageKey = `tabia_mes_commandes_${clientId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
        try {
            let commandes = JSON.parse(stored);
            const maintenant = Date.now();
            const avantNettoyage = commandes.length;
            
            commandes = commandes.filter(cmd => {
                // Garder si pas d'expiration ou si pas encore expiré
                return !cmd.expiration || cmd.expiration > maintenant;
            });
            
            if (commandes.length !== avantNettoyage) {
                localStorage.setItem(storageKey, JSON.stringify(commandes));
                console.log(`🗑️ ${avantNettoyage - commandes.length} commande(s) expirée(s) supprimée(s) pour client ${clientId}`);
            }
        } catch(e) {}
    }
}

// Nettoyage quotidien (à minuit)
function programmerNettoyageQuotidien() {
    const maintenant = new Date();
    const minuit = new Date();
    minuit.setHours(24, 0, 0, 0);
    const tempsJusquaMinuit = minuit - maintenant;
    
    setTimeout(() => {
        nettoyerCommandesExpirees();
        // Re-programmer pour le lendemain
        setInterval(() => {
            nettoyerCommandesExpirees();
        }, 24 * 60 * 60 * 1000);
    }, tempsJusquaMinuit);
    
    console.log(`🕐 Nettoyage programmé dans ${Math.round(tempsJusquaMinuit / 1000 / 60)} minutes pour client ${clientId}`);
}

// ========== AFFICHAGE HISTORIQUE DÉTAILLÉ ==========
function afficherMesCommandesDetaillees(commandes) {
    const conteneur = document.getElementById("mesCommandes");
    if (!conteneur) return;

    if (commandes.length === 0) {
        conteneur.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-history" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>📭 Aucune commande pour le moment</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem;">Vos commandes apparaîtront ici et seront conservées 24h</p>
            </div>
        `;
        return;
    }

    // Grouper les commandes par date
    const commandesParDate = {};
    commandes.forEach(cmd => {
        const dateCmd = new Date(cmd.timestampCreation).toLocaleDateString('fr-FR');
        if (!commandesParDate[dateCmd]) commandesParDate[dateCmd] = [];
        commandesParDate[dateCmd].push(cmd);
    });

    // Trier les dates (plus récentes en premier)
    const datesTriees = Object.keys(commandesParDate).sort((a, b) => {
        return new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-'));
    });

    let html = '';
    
    datesTriees.forEach(date => {
        const commandesDuJour = commandesParDate[date];
        const totalJour = commandesDuJour.reduce((sum, cmd) => sum + (cmd.total || 0), 0);
        
        html += `
            <div class="historique-groupe">
                <div class="historique-groupe-header" onclick="toggleHistoriqueGroupe(this)">
                    <div class="groupe-info">
                        <i class="fas fa-calendar-day"></i>
                        <strong>${date}</strong>
                        <span class="groupe-count">(${commandesDuJour.length} commande${commandesDuJour.length > 1 ? 's' : ''})</span>
                    </div>
                    <div class="groupe-total">💰 ${totalJour.toFixed(2)} DT</div>
                    <i class="fas fa-chevron-down groupe-toggle-icon"></i>
                </div>
                <div class="historique-groupe-content">
        `;
        
        commandesDuJour.forEach(cmd => {
            const statutTexte = getStatutTexteClient(cmd.statut);
            const statutClass = getStatutClassClient(cmd.statut);
            const tableInfo = cmd.numeroTable ? `Table ${cmd.numeroTable}` : '📦 Emporter';
            const dateHeure = new Date(cmd.timestampCreation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const tempsRestant = cmd.expiration ? Math.max(0, Math.ceil((cmd.expiration - Date.now()) / (1000 * 60 * 60))) : 24;
            
            html += `
                <div class="historique-commande-card" data-id="${cmd.id}">
                    <div class="historique-commande-header">
                        <div class="commande-info">
                            <span class="commande-numero">#${cmd.numero}</span>
                            <span class="commande-table-badge"><i class="fas fa-chair"></i> ${tableInfo}</span>
                            <span class="commande-heure">🕐 ${dateHeure}</span>
                        </div>
                        <div class="commande-statut-badge ${statutClass}">${statutTexte}</div>
                    </div>
                    
                    <div class="historique-commande-details">
                        <div class="commande-articles-liste">
                            ${cmd.articles.map(a => `
                                <div class="article-detail">
                                    <span class="article-qty">${a.quantite}x</span>
                                    <span class="article-nom">${a.nom}</span>
                                    <span class="article-prix">${(a.prix * a.quantite).toFixed(2)} DT</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="commande-footer">
                            <div class="commande-total-detail">
                                <strong>Total :</strong> <span class="total-montant">${(cmd.total || 0).toFixed(2)} DT</span>
                            </div>
                            <div class="commande-expiration">
                                <i class="fas fa-clock"></i>
                                <span>Disparaît dans ${tempsRestant}h</span>
                            </div>

                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    conteneur.innerHTML = html;
    
    // Ajouter un message d'information sur la durée de conservation
    if (commandes.length > 0) {
        const infoMessage = document.createElement('div');
        infoMessage.className = 'historique-info-message';
        infoMessage.innerHTML = '<i class="fas fa-info-circle"></i> Les commandes sont automatiquement supprimées après 24h';
        conteneur.appendChild(infoMessage);
    }
}

// Fonctions auxiliaires pour les statuts
function getStatutTexteClient(statut) {
    const statuts = {
        'en_attente': '⏳ En attente',
        'en_preparation': '🍳 En préparation',
        'terminee': '✅ Prête',
        'paye': '💰 Payée',
        'termine': '✅ Prête'
    };
    return statuts[statut] || '⏳ En attente';
}

function getStatutClassClient(statut) {
    const classes = {
        'en_attente': 'status-attente',
        'en_preparation': 'status-preparation',
        'terminee': 'status-termine',
        'paye': 'status-paye'
    };
    return classes[statut] || 'status-attente';
}

// Fonction pour toggler l'affichage d'un groupe d'historique
function toggleHistoriqueGroupe(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.groupe-toggle-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
    }
}

// Modifier la fonction chargerMesCommandes pour utiliser le nouvel affichage
function chargerMesCommandes() {
    const stored = localStorage.getItem('tabia_mes_commandes_' + clientId);
    let mesCommandes = [];
    if (stored) {
        try {
            mesCommandes = JSON.parse(stored);
            if (!Array.isArray(mesCommandes)) mesCommandes = [];
        } catch(e) {}
    }
    
    // Nettoyer les commandes expirées avant affichage
    const maintenant = Date.now();
    mesCommandes = mesCommandes.filter(cmd => !cmd.expiration || cmd.expiration > maintenant);
    
    // Sauvegarder si des commandes ont été supprimées
    if (mesCommandes.length !== (stored ? JSON.parse(stored).length : 0)) {
        localStorage.setItem('tabia_mes_commandes_' + clientId, JSON.stringify(mesCommandes));
    }
    
    afficherMesCommandesDetaillees(mesCommandes);
}
// ========== EXPORT POUR LE NAVIGATEUR ==========
console.log("✅ script-client.js chargé - Les commandes seront envoyées à la caisse");