// 1. I tuoi dati
const clientId = 'ccbbf69fc0c642089bae531a517c5aa9'; 
const redirectUri = 'https://giovypass06.github.io/vibecheck/'; 
const scopes = 'user-top-read';

// 2. Funzione per generare una stringa casuale
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// 3. Funzione per crittografare la stringa
async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

const loginButton = document.getElementById('login-btn');

// 4. Cosa succede al click sul login
loginButton.addEventListener('click', async () => {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    window.localStorage.setItem('code_verifier', codeVerifier);

    const args = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: scopes,
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    window.location = 'https://accounts.spotify.com/authorize?' + args.toString();
});

// --- LOGICA DI AVVIO ---

const urlParams = new URLSearchParams(window.location.search);
let code = urlParams.get('code');
const existingToken = localStorage.getItem('access_token');

if (existingToken) {
    // Se abbiamo già fatto il login in passato, carica subito i dati
    document.getElementById('login-btn').style.display = 'none';
    ottieniStatistiche();
} else if (code) {
    // Se stiamo tornando da Spotify con lo scontrino, fai lo scambio
    document.getElementById('login-btn').style.display = 'none';
    scambiaCodicePerToken(code);
}

// --- FASE 2: RITIRO DEL TOKEN ---

async function scambiaCodicePerToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');

    const payload = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        }),
    };

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', payload);
        const data = await response.json();
        
        if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            window.history.pushState({}, document.title, window.location.pathname);
            
            alert("Login completato con successo, fra! Token ottenuto.");
            ottieniStatistiche();
        } else {
            console.error("Errore da Spotify nella fase di scambio:", data);
        }
    } catch (error) {
        console.error("Errore di rete:", error);
    }
}

// --- FASE 3: SCARICARE E MOSTRARE I DATI ---

// --- FASE 3: SCARICARE E MOSTRARE I DATI ---

async function ottieniStatistiche() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        // 1. Chiamata per gli ARTISTI
        const rispostaArtisti = await fetch('https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=5', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const datiArtisti = await rispostaArtisti.json();

        // 2. Chiamata per le CANZONI (tracks)
        const rispostaCanzoni = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const datiCanzoni = await rispostaCanzoni.json();

        // Passiamo entrambi i gruppi di dati alla funzione che li stampa
        mostraDatiSuSchermo(datiArtisti.items, datiCanzoni.items);
        
    } catch (error) {
        console.error("Errore nel recupero dei dati:", error);
    }
}

// Funzione aggiornata per iniettare sia artisti che canzoni
function mostraDatiSuSchermo(artisti, canzoni) {
    const container = document.getElementById('stats-container');
    
    // Svuotiamo il contenitore
    container.innerHTML = '';
    
    // --- BLOCCO ARTISTI ---
    container.innerHTML += '<h2>Top 5 Artisti:</h2>';
    if (artisti && artisti.length > 0) {
        artisti.forEach((artista, index) => {
            container.innerHTML += `<p>${index + 1}. ${artista.name}</p>`;
        });
    }
    
    // --- BLOCCO CANZONI ---
    container.innerHTML += '<h2>Top 5 Canzoni:</h2>';
    if (canzoni && canzoni.length > 0) {
        canzoni.forEach((canzone, index) => {
            // Per le canzoni stampiamo: "Nome Canzone - Nome Artista"
            container.innerHTML += `<p>${index + 1}. ${canzone.name} - <em>${canzone.artists[0].name}</em></p>`;
        });
    }
}