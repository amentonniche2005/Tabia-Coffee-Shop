const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session'); // AJOUT

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ========== CONFIGURATION DES SESSIONS ==========
app.use(session({
    secret: 'tabia_coffee_shop_secret_2024',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 8 * 60 * 60 * 1000 // 8 heures
    }
}));

// ========== MOT DE PASSE DE LA CAISSE ==========
const CAISSE_PASSWORD = "00000"; // Modifiez ce code

// ========== ROUTES DE SÉCURITÉ ==========

// Route pour vérifier le mot de passe
app.post('/api/caisse/verify', (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ success: false, message: "Mot de passe requis" });
    }
    
    if (password === CAISSE_PASSWORD) {
        req.session.caisseAuth = true;
        console.log('✅ Authentification caisse réussie');
        res.json({ success: true, message: "Authentification réussie" });
    } else {
        console.log('❌ Tentative échouée');
        res.status(401).json({ success: false, message: "Mot de passe incorrect" });
    }
});

// Route pour vérifier l'état de l'authentification
app.get('/api/caisse/check', (req, res) => {
    if (req.session.caisseAuth) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

// Route pour se déconnecter
app.post('/api/caisse/logout', (req, res) => {
    req.session.destroy();
    console.log('🔓 Déconnexion de la caisse');
    res.json({ success: true });
});

// Route protégée pour accéder à la caisse
app.get('/caisse', (req, res) => {
    if (req.session.caisseAuth) {
        res.sendFile(path.join(__dirname, 'caisse.html'));
    } else {
        res.sendFile(path.join(__dirname, 'caisse-login.html'));
    }
});

// Redirection pour éviter l'accès direct à caisse.html
app.get('/caisse.html', (req, res) => {
    res.redirect('/caisse');
});

// ========== FONCTIONS BASE DE DONNÉES ==========
const DB_PATH = path.join(__dirname, 'database.json');

function readDatabase() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lecture database.json:', error);
        return { numbers: [] };
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Erreur écriture database.json:', error);
        return false;
    }
}

function generateRandomId() {
    return Math.floor(Math.random() * 90000) + 10000;
}

function needsUpdate(lastUpdated) {
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    return (now - lastUpdated) >= ONE_HOUR;
}

function updateExpiredIds() {
    const db = readDatabase();
    let updated = false;
    const now = Date.now();
    
    if (!db.numbers || !Array.isArray(db.numbers)) {
        console.error('Structure de database.json invalide');
        return { numbers: [] };
    }
    
    db.numbers = db.numbers.map(item => {
        if (needsUpdate(item.lastUpdated)) {
            updated = true;
            const newId = generateRandomId().toString();
            console.log(`Mise à jour du numéro ${item.numero}: ${item.id} -> ${newId}`);
            return {
                ...item,
                id: newId,
                lastUpdated: now
            };
        }
        return item;
    });
    
    if (updated) {
        writeDatabase(db);
        console.log(`[${new Date().toISOString()}] IDs mis à jour`);
    }
    
    return db;
}

// ========== API ROUTES ==========

app.get('/api/numbers', (req, res) => {
    const db = updateExpiredIds();
    res.json(db.numbers);
});

app.get('/api/number/:numero', (req, res) => {
    const numero = parseInt(req.params.numero);
    
    if (isNaN(numero) || numero < 1 || numero > 20) {
        return res.status(400).json({ error: 'Numéro invalide' });
    }
    
    const db = updateExpiredIds();
    const item = db.numbers.find(n => n.numero === numero);
    
    if (!item) {
        return res.status(404).json({ error: 'Numéro non trouvé' });
    }
    
    res.json({
        numero: item.numero,
        id: item.id,
        lastUpdated: item.lastUpdated
    });
});

app.post('/api/number/:numero/refresh', (req, res) => {
    const numero = parseInt(req.params.numero);
    
    if (isNaN(numero) || numero < 1 || numero > 20) {
        return res.status(400).json({ error: 'Numéro invalide' });
    }
    
    const db = readDatabase();
    const index = db.numbers.findIndex(n => n.numero === numero);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Numéro non trouvé' });
    }
    
    const newId = generateRandomId().toString();
    const now = Date.now();
    
    db.numbers[index] = {
        ...db.numbers[index],
        id: newId,
        lastUpdated: now
    };
    
    writeDatabase(db);
    
    res.json({
        success: true,
        numero: db.numbers[index].numero,
        id: db.numbers[index].id,
        lastUpdated: db.numbers[index].lastUpdated
    });
});

app.get('/api/verify-code/:numTable/:code', (req, res) => {
    const numero = parseInt(req.params.numTable);
    const code = req.params.code;
    
    if (numero < 1 || numero > 20) {
        return res.status(400).json({ error: 'Numéro de table invalide' });
    }
    
    if (!/^\d{5}$/.test(code)) {
        return res.status(400).json({ error: 'Code doit être 5 chiffres' });
    }
    
    try {
        const db = readDatabase();
        const item = db.numbers.find(n => n.numero === numero);
        
        if (item && item.id === code) {
            res.json({ valid: true, numero: item.numero });
        } else {
            res.status(401).json({ valid: false, error: "Code incorrect" });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ========== COMMANDES (stockage mémoire) ==========
let commandes = [];

app.post('/api/commandes', (req, res) => {
    const { articles, numeroTable, clientId } = req.body;
    
    const nouvelleCommande = {
        id: Date.now(),
        numero: 'CMD' + Math.floor(Math.random() * 10000),
        date: new Date().toLocaleString(),
        timestamp: Date.now(),
        articles: articles,
        numeroTable: numeroTable,
        clientId: clientId,
        statut: 'en_attente',
        total: articles.reduce((sum, a) => sum + (a.prix * a.quantite), 0)
    };
    
    commandes.push(nouvelleCommande);
    io.emit('commandes_initiales', commandes);
    res.json(nouvelleCommande);
});

app.put('/api/commandes/:id/statut', (req, res) => {
    const id = parseInt(req.params.id);
    const { statut } = req.body;
    
    const commande = commandes.find(c => c.id === id);
    if (commande) {
        commande.statut = statut;
        io.emit('commandes_initiales', commandes);
        res.json(commande);
    } else {
        res.status(404).json({ error: 'Commande non trouvée' });
    }
});

app.delete('/api/commandes/:id', (req, res) => {
    const id = parseInt(req.params.id);
    commandes = commandes.filter(c => c.id !== id);
    io.emit('commandes_initiales', commandes);
    res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
    const enAttente = commandes.filter(c => c.statut === 'en_attente').length;
    const enPreparation = commandes.filter(c => c.statut === 'en_preparation').length;
    const terminees = commandes.filter(c => c.statut === 'termine').length;
    const total = commandes.reduce((sum, c) => sum + c.total, 0);
    
    res.json({
        commandes: commandes.length,
        enAttente,
        enPreparation,
        terminees,
        chiffreAffaires: total
    });
});

// ========== SERVIR LES PAGES ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-print.html'));
});

app.get('/comptoir', (req, res) => {
    res.sendFile(path.join(__dirname, 'comptoir.html'));
});

// ========== DÉMARRAGE ==========
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ========== SERVEUR DÉMARRÉ ==========`);
    console.log(`📍 Client: http://localhost:${PORT}`);
    console.log(`📍 Admin: http://localhost:${PORT}/admin`);
    console.log(`📍 Caisse: http://localhost:${PORT}/caisse`);
    console.log(`📍 Comptoir: http://localhost:${PORT}/comptoir`);
    console.log(`========================================\n`);
    
    updateExpiredIds();
    setInterval(updateExpiredIds, 3600000);
});