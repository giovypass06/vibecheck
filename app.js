// 1. I tuoi dati
const clientId = 'ccbbf69fc0c642089bae531a517c5aa9'; 
const redirectUri = 'https://giovypass06.github.io/vibecheck/'; 
const scopes = 'user-top-read';

// 2. Funzione per generare una stringa casuale (la nostra "password" usa-e-getta)
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// 3. Funzione per crittografare la stringa (il lucchetto di sicurezza)
async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

const loginButton = document.getElementById('login-btn');

// 4. Cosa succede al click
loginButton.addEventListener('click', async () => {
    
    // Generiamo i codici di sicurezza
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Salviamo il "Verifier" nella memoria del browser perché ci servirà DOPO il login
    window.localStorage.setItem('code_verifier', codeVerifier);

    // Costruiamo il nuovo link per Spotify usando il formato corretto
    const args = new URLSearchParams({
        response_type: 'code', // Ecco il famoso code!
        client_id: clientId,
        scope: scopes,
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    // Reindirizziamo l'utente
    window.location = 'https://accounts.spotify.com/authorize?' + args.toString();
});

// --- FASE 2: LETTURA DEL CODICE E RITIRO DEL TOKEN ---

// Controlliamo se nell'URL c'è il parametro "?code="
const urlParams = new URLSearchParams(window.location.search);
let code = urlParams.get('code');

// Se troviamo il codice nell'URL, facciamo partire lo scambio
if (code) {
    // Nascondiamo il bottone di login per far capire che sta caricando
    document.getElementById('login-btn').style.display = 'none';
    
    // Avviamo la funzione per prendere il token
    scambiaCodicePerToken(code);
}

// Funzione che parla con Spotify per ottenere l'Access Token
async function scambiaCodicePerToken(code) {
    // Recuperiamo il "lucchetto" che avevamo salvato prima del login
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
            redirect_uri: redirectUri, // Deve essere identico a quello che hai sulla Dashboard
            code_verifier: codeVerifier,
        }),
    };

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', payload);
        const data = await response.json();
        
        if (data.access_token) {
            // CI SIAMO! Abbiamo il pass definitivo. Lo salviamo nella memoria del browser.
            localStorage.setItem('access_token', data.access_token);
            
            // Magia: puliamo l'URL in alto per far sparire quel codice chilometrico
            window.history.pushState({}, document.title, window.location.pathname);
            
            alert("Login completato con successo, fra! Token ottenuto.");
            
            // Prossimamente qui aggiungeremo la funzione per scaricare i dati
        } else {
            console.error("Errore da Spotify nella fase di scambio:", data);
        }
    } catch (error) {
        console.error("Errore di rete:", error);
    }
}