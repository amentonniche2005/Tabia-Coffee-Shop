const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

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
app.get('*', (req, res, next) => {
  // Vérifier si le fichier demandé existe
  const filePath = path.join(__dirname, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    next();
  }
});
// Chemin vers database.json
const DB_PATH = path.join(__dirname, 'database.json');

// ========== FONCTIONS BASE DE DONNÉES ==========
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
            console.log(`Mise à jour du numéro ${item.numero}: ancien ID ${item.id} -> nouveau ID ${newId}`);
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
        console.log(`[${new Date().toISOString()}] IDs mis à jour automatiquement`);
    }
    
    return db;
}

// ========== STOCKAGE DES COMMANDES ==========
let commandes = [];

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
    console.log('🔌 Nouveau client connecté:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('🔌 Client déconnecté:', socket.id);
    });
});

function notifyAll() {
    io.emit('commandes_initiales', commandes);
}

// ========== API ROUTES ==========

// API pour récupérer tous les numéros
app.get('/api/numbers', (req, res) => {
    const db = updateExpiredIds();
    res.json(db.numbers);
});

// API pour récupérer un numéro spécifique
app.get('/api/number/:numero', (req, res) => {
    const numero = parseInt(req.params.numero);
    
    if (isNaN(numero) || numero < 1 || numero > 20) {
        return res.status(400).json({ error: 'Le numéro doit être compris entre 1 et 20' });
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

// API pour forcer la mise à jour d'un ID
app.post('/api/number/:numero/refresh', (req, res) => {
    const numero = parseInt(req.params.numero);
    
    if (isNaN(numero) || numero < 1 || numero > 20) {
        return res.status(400).json({ error: 'Le numéro doit être compris entre 1 et 20' });
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
        lastUpdated: db.numbers[index].lastUpdated,
        message: `ID du numéro ${numero} mis à jour avec succès`
    });
});

// API pour vérifier le code de confirmation
app.get('/api/verify-code/:numTable/:code', (req, res) => {
    const numero = parseInt(req.params.numTable);
    const code = req.params.code;
    
    if (numero < 1 || numero > 20) {
        return res.status(400).json({ error: 'Le numéro de table doit être entre 1 et 20' });
    }
    
    if (!/^\d{5}$/.test(code)) {
        return res.status(400).json({ error: 'Le code doit être composé de 5 chiffres' });
    }
    
    try {
        const db = readDatabase();
        const item = db.numbers.find(n => n.numero === numero);
        
        if (item && item.id === code) {
            res.json({ 
                valid: true, 
                numero: item.numero,
                message: "Code valide ✅"
            });
        } else {
            res.status(401).json({ 
                valid: false, 
                error: "Code de confirmation incorrect ❌"
            });
        }
    } catch (error) {
        console.error('Erreur lors de la vérification:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// API pour créer une commande
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
    notifyAll();
    res.json(nouvelleCommande);
});

// API pour changer le statut d'une commande
app.put('/api/commandes/:id/statut', (req, res) => {
    const id = parseInt(req.params.id);
    const { statut } = req.body;
    
    const commande = commandes.find(c => c.id === id);
    if (commande) {
        commande.statut = statut;
        notifyAll();
        res.json(commande);
    } else {
        res.status(404).json({ error: 'Commande non trouvée' });
    }
});

// API pour supprimer une commande
app.delete('/api/commandes/:id', (req, res) => {
    const id = parseInt(req.params.id);
    commandes = commandes.filter(c => c.id !== id);
    notifyAll();
    res.json({ success: true });
});

// API pour payer une commande
app.put('/api/commandes/:id/payer', (req, res) => {
    const id = parseInt(req.params.id);
    const commande = commandes.find(c => c.id === id);
    if (commande) {
        commande.statut = 'paye';
        notifyAll();
        res.json(commande);
    } else {
        res.status(404).json({ error: 'Commande non trouvée' });
    }
});

// API pour les stats
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

// Servir l'index.html (interface client)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Servir l'admin-print.html (interface admin/impression)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-print.html'));
});

// Démarrer le serveur
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ========== SERVEUR DÉMARRÉ ==========`);
    console.log(`📍 Interface client: http://localhost:${PORT}`);
    console.log(`📍 Interface admin: http://localhost:${PORT}/admin`);
    console.log(`📍 Caisse: http://localhost:${PORT}/caisse.html`);
    console.log(`📍 Comptoir: http://localhost:${PORT}/comptoir.html`);
    console.log(`📁 Base de données: ${DB_PATH}`);
    console.log(`========================================\n`);
    
    updateExpiredIds();
    setInterval(updateExpiredIds, 3600000);
});