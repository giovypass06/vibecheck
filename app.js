// 1. I tuoi dati
const clientId = 'ccbbf69fc0c642089bae531a517c5aa9'; 
const redirectUri = 'https://giovypass06.github.io/vibecheck/'; 
const scopes = 'user-top-read';

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

const loginButton = document.getElementById('login-btn');
if (loginButton) {
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
}

// --- LOGICA DI AVVIO ---
const urlParams = new URLSearchParams(window.location.search);
let code = urlParams.get('code');
const existingToken = localStorage.getItem('access_token');

if (existingToken) {
    if (loginButton) loginButton.style.display = 'none';
    ottieniStatistiche();
} else if (code) {
    if (loginButton) loginButton.style.display = 'none';
    scambiaCodicePerToken(code);
}

// --- FASE 2: RITIRO DEL TOKEN ---
async function scambiaCodicePerToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');
    const payload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
            console.error("Errore scambio token:", data);
        }
    } catch (error) {
        console.error("Errore di rete:", error);
    }
}

// --- FASE 3: SCARICARE I DATI ---
async function ottieniStatistiche(timeRange = 'short_term') {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const filters = document.getElementById('filters-container');
    const statsContainer = document.getElementById('stats-container');
    
    if (filters) filters.style.display = 'block';
    if (statsContainer) statsContainer.innerHTML = '<p>Caricamento dati in corso...</p>';

    try {
        const rispostaArtisti = await fetch(`https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=5`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (rispostaArtisti.status === 401) {
            alert("Il tuo pass è scaduto. Fai di nuovo l'accesso!");
            localStorage.removeItem('access_token');
            window.location.reload();
            return;
        }

        const datiArtisti = await rispostaArtisti.json();

        const rispostaCanzoni = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=5`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const datiCanzoni = await rispostaCanzoni.json();

        mostraDatiSuSchermo(datiArtisti.items, datiCanzoni.items);
        
    } catch (error) {
        console.error("Errore API:", error);
        if (statsContainer) statsContainer.innerHTML = '<p style="color:red;">Errore nel caricamento. Controlla la console.</p>';
    }
}

// --- FASE 4: EVENTI BOTTONI ---
const btnShort = document.getElementById('btn-short');
const btnMedium = document.getElementById('btn-medium');
const btnLong = document.getElementById('btn-long');

if (btnShort) btnShort.addEventListener('click', () => ottieniStatistiche('short_term'));
if (btnMedium) btnMedium.addEventListener('click', () => ottieniStatistiche('medium_term'));
if (btnLong) btnLong.addEventListener('click', () => ottieniStatistiche('long_term'));

// --- FASE 5: STAMPA A SCHERMO ---
function mostraDatiSuSchermo(artisti, canzoni) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    container.innerHTML = ''; 
    
    container.innerHTML += '<h2>Top 5 Artisti:</h2>';
    if (artisti && artisti.length > 0) {
        artisti.forEach((artista, index) => {
            // Controlli di sicurezza se mancano foto o generi
            const immagineUrl = artista.images && artista.images.length > 0 ? artista.images[0].url : '';
            const generi = artista.genres && artista.genres.length > 0 ? artista.genres.join(', ') : 'Nessun genere specifico';
            const linkSpotify = artista.external_urls ? artista.external_urls.spotify : '#';
            const idTendina = `dettaglio-artista-${index}`;
            
            container.innerHTML += `
                <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; cursor: pointer;" onclick="apriChiudiDettagli('${idTendina}')">
                        <img src="${immagineUrl}" width="60" height="60" style="border-radius: 50%; object-fit: cover; margin-right: 15px;">
                        <p style="margin: 0; flex-grow: 1;"><b>${index + 1}. ${artista.name}</b></p>
                        <span style="font-size: 12px; color: gray;">Espandi ▼</span>
                    </div>
                    <div id="${idTendina}" style="display: none; margin-top: 10px; margin-left: 75px;">
                        <p style="margin: 5px 0; font-size: 14px; text-transform: capitalize;"><b>Generi:</b> ${generi}</p>
                        <a href="${linkSpotify}" target="_blank" style="color: #1DB954; font-size: 14px; text-decoration: none; font-weight: bold;">Apri Artista ↗</a>
                    </div>
                </div>`;
        });
    }
    
    container.innerHTML += '<h2 style="margin-top: 30px;">Top 5 Canzoni:</h2>';
    if (canzoni && canzoni.length > 0) {
        canzoni.forEach((canzone, index) => {
            const immagineUrl = canzone.album && canzone.album.images.length > 0 ? canzone.album.images[0].url : '';
            const linkCanzone = canzone.external_urls ? canzone.external_urls.spotify : '#';
            const nomeArtista = canzone.artists && canzone.artists.length > 0 ? canzone.artists[0].name : 'Artista sconosciuto';
            const linkArtista = canzone.artists && canzone.artists.length > 0 ? canzone.artists[0].external_urls.spotify : '#';
            
            const playerAudio = canzone.preview_url 
                ? `<audio controls src="${canzone.preview_url}" style="height: 35px; width: 100%; margin-top: 10px;"></audio>` 
                : `<p style="font-size: 12px; color: gray; margin-top: 10px;">Preview non disponibile.</p>`;
            
            const idTendina = `dettaglio-canzone-${index}`;
            
            container.innerHTML += `
                <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; cursor: pointer;" onclick="apriChiudiDettagli('${idTendina}')">
                        <img src="${immagineUrl}" width="60" height="60" style="object-fit: cover; margin-right: 15px;">
                        <div style="flex-grow: 1;">
                            <p style="margin: 0;"><b>${index + 1}. ${canzone.name}</b></p>
                            <p style="margin: 0; font-size: 14px; color: gray;">${nomeArtista}</p>
                        </div>
                        <span style="font-size: 12px; color: gray;">Espandi ▼</span>
                    </div>
                    <div id="${idTendina}" style="display: none; margin-top: 10px; margin-left: 75px;">
                        <div style="display: flex; gap: 15px;">
                            <a href="${linkCanzone}" target="_blank" style="color: #1DB954; font-size: 14px; text-decoration: none; font-weight: bold;">Ascolta Brano ↗</a>
                            <a href="${linkArtista}" target="_blank" style="color: #1DB954; font-size: 14px; text-decoration: none; font-weight: bold;">Vai all'Artista ↗</a>
                        </div>
                        ${playerAudio}
                    </div>
                </div>`;
        });
    }
}

function apriChiudiDettagli(idSezione) {
    const sezione = document.getElementById(idSezione);
    if (!sezione) return;
    if (sezione.style.display === 'none') {
        sezione.style.display = 'block';
    } else {
        sezione.style.display = 'none';
    }
}