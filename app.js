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

// --- FASE 3: SCARICARE E MOSTRARE I DATI ---

// Ora la funzione accetta un parametro "timeRange", di base impostato su 'short_term'
async function ottieniStatistiche(timeRange = 'short_term') {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Mostriamo i bottoni dei filtri ora che abbiamo fatto il login
    document.getElementById('filters-container').style.display = 'block';

    // Puliamo il contenitore mettendoci una scritta di caricamento
    document.getElementById('stats-container').innerHTML = '<p>Caricamento dati...</p>';

    try {
        // Usiamo la variabile timeRange direttamente nel link della chiamata API
        const rispostaArtisti = await fetch(`https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=5`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const datiArtisti = await rispostaArtisti.json();

        const rispostaCanzoni = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=5`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const datiCanzoni = await rispostaCanzoni.json();

        mostraDatiSuSchermo(datiArtisti.items, datiCanzoni.items);
        
    } catch (error) {
        console.error("Errore nel recupero dei dati:", error);
        document.getElementById('stats-container').innerHTML = '<p>Errore nel caricamento.</p>';
    }
}

// --- FASE 4: GESTIONE DEI BOTTONI FILTRO ---

// Quando clicchi un bottone, rifà la chiamata API con il periodo corretto
document.getElementById('btn-short').addEventListener('click', () => {
    ottieniStatistiche('short_term');
});

document.getElementById('btn-medium').addEventListener('click', () => {
    ottieniStatistiche('medium_term');
});

document.getElementById('btn-long').addEventListener('click', () => {
    ottieniStatistiche('long_term');
});


// Funzione aggiornata per iniettare artisti e canzoni CON MENU A TENDINA
function mostraDatiSuSchermo(artisti, canzoni) {
    const container = document.getElementById('stats-container');
    container.innerHTML = ''; // Svuota il contenitore
    
    // --- BLOCCO ARTISTI ---
    container.innerHTML += '<h2>Top 5 Artisti:</h2>';
    if (artisti && artisti.length > 0) {
        artisti.forEach((artista, index) => {
            const immagineUrl = artista.images.length > 0 ? artista.images[0].url : '';
            // Uniamo i generi con una virgola. Se non ci sono, mettiamo un testo di default.
            const generi = artista.genres.length > 0 ? artista.genres.join(', ') : 'Nessun genere specifico';
            const linkSpotify = artista.external_urls.spotify;
            
            // Creiamo un ID unico per ogni tendina (es. dettaglio-artista-0, dettaglio-artista-1)
            const idTendina = `dettaglio-artista-${index}`;
            
            container.innerHTML += `
                <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <!-- RIGA PRINCIPALE (Cliccabile) -->
                    <div style="display: flex; align-items: center; cursor: pointer;" onclick="apriChiudiDettagli('${idTendina}')">
                        <img src="${immagineUrl}" width="60" height="60" style="border-radius: 50%; object-fit: cover; margin-right: 15px;">
                        <p style="margin: 0; flex-grow: 1;"><b>${index + 1}. ${artista.name}</b></p>
                        <span style="font-size: 12px; color: gray;">Espandi ▼</span>
                    </div>
                    
                    <!-- MENU A TENDINA NASCOSTO -->
                    <div id="${idTendina}" style="display: none; margin-top: 10px; margin-left: 75px;">
                        <p style="margin: 5px 0; font-size: 14px; text-transform: capitalize;"><b>Generi:</b> ${generi}</p>
                        <a href="${linkSpotify}" target="_blank" style="color: #1DB954; font-size: 14px; text-decoration: none; font-weight: bold;">Apri Artista su Spotify ↗</a>
                    </div>
                </div>`;
        });
    }
    
    // --- BLOCCO CANZONI ---
    container.innerHTML += '<h2 style="margin-top: 30px;">Top 5 Canzoni:</h2>';
    if (canzoni && canzoni.length > 0) {
        canzoni.forEach((canzone, index) => {
            const immagineUrl = canzone.album.images.length > 0 ? canzone.album.images[0].url : '';
            const linkCanzone = canzone.external_urls.spotify;
            const linkArtista = canzone.artists[0].external_urls.spotify;
            
            // La preview non è sempre disponibile per tutte le canzoni, facciamo un controllo
            const playerAudio = canzone.preview_url 
                ? `<audio controls src="${canzone.preview_url}" style="height: 35px; width: 100%; margin-top: 10px;"></audio>` 
                : `<p style="font-size: 12px; color: gray; margin-top: 10px;">Preview audio non disponibile per questa traccia.</p>`;
            
            const idTendina = `dettaglio-canzone-${index}`;
            
            container.innerHTML += `
                <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <!-- RIGA PRINCIPALE (Cliccabile) -->
                    <div style="display: flex; align-items: center; cursor: pointer;" onclick="apriChiudiDettagli('${idTendina}')">
                        <img src="${immagineUrl}" width="60" height="60" style="object-fit: cover; margin-right: 15px;">
                        <div style="flex-grow: 1;">
                            <p style="margin: 0;"><b>${index + 1}. ${canzone.name}</b></p>
                            <p style="margin: 0; font-size: 14px; color: gray;">${canzone.artists[0].name}</p>
                        </div>
                        <span style="font-size: 12px; color: gray;">Espandi ▼</span>
                    </div>
                    
                    <!-- MENU A TENDINA NASCOSTO -->
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

// Funzione che accende/spegne la visibilità della tendina
function apriChiudiDettagli(idSezione) {
    const sezione = document.getElementById(idSezione);
    // Se è nascosta, la mostriamo (block). Se è visibile, la nascondiamo (none).
    if (sezione.style.display === 'none') {
        sezione.style.display = 'block';
    } else {
        sezione.style.display = 'none';
    }
}