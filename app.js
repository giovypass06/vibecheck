// 1. I tuoi dati (Ho aggiunto i nuovi permessi negli scopes!)
const clientId = 'ccbbf69fc0c642089bae531a517c5aa9'; 
const redirectUri = 'https://giovypass06.github.io/vibecheck/'; 
const scopes = 'user-top-read playlist-modify-public user-read-currently-playing user-read-private';

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
            ottieniStatistiche();
        }
    } catch (error) {
        console.error("Errore di rete:", error);
    }
}

// --- FUNZIONI API PRINCIPALI ---
async function ottieniStatistiche(timeRange = 'short_term') {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    document.getElementById('filters-container').style.display = 'flex';
    document.getElementById('actions-container').style.display = 'flex';
    document.getElementById('stats-container').innerHTML = '<p>Caricamento dati in corso...</p>';

    try {
        const proxyUrl = 'https://corsproxy.io/?';

        // Lanciamo le chiamate principali (Limite 50 come hai chiesto)
        const resArtisti = await fetch(proxyUrl + encodeURIComponent(`https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=50`), {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (resArtisti.status === 401) {
            alert("Sessione scaduta. Pulisci la cache e rifai l'accesso!");
            localStorage.removeItem('access_token');
            window.location.reload();
            return;
        }

        const datiArtisti = await resArtisti.json();

        const resCanzoni = await fetch(proxyUrl + encodeURIComponent(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`), {
            headers: { Authorization: `Bearer ${token}` }
        });
        const datiCanzoni = await resCanzoni.json();

        // Salviamo gli URI delle canzoni globalmente per la funzione Playlist
        window.canzoniSalvatePerPlaylist = datiCanzoni.items.map(c => c.uri);

        mostraDatiSuSchermo(datiArtisti.items, datiCanzoni.items);
        
        // Avviamo le nuove feature
        ottieniLiveStatus(token, proxyUrl);
        calcolaVibeScore(datiCanzoni.items, token, proxyUrl);

    } catch (error) {
        console.error("Errore API:", error);
    }
}

// --- FEATURE 1: LIVE STATUS ---
async function ottieniLiveStatus(token, proxyUrl) {
    try {
        const res = await fetch(proxyUrl + encodeURIComponent('https://api.spotify.com/v1/me/player/currently-playing'), {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 200) {
            const data = await res.json();
            if (data && data.item) {
                document.getElementById('live-status-container').innerHTML = `
                    <div style="background-color: #1DB954; color: black; padding: 10px; border-radius: 8px; margin-bottom: 25px; text-align: center; font-weight: bold;">
                        🎧 Ora in ascolto: ${data.item.name} - ${data.item.artists[0].name}
                    </div>`;
            }
        } else {
            document.getElementById('live-status-container').innerHTML = '';
        }
    } catch (e) { console.error("Errore Live Status:", e); }
}

// --- FEATURE 2: VIBE SCORE (Analisi Audio) ---
async function calcolaVibeScore(canzoni, token, proxyUrl) {
    if (!canzoni || canzoni.length === 0) return;
    
    // Prendiamo gli ID delle prime 20 canzoni per fare la media
    const ids = canzoni.slice(0, 20).map(c => c.id).join(',');
    
    try {
        const res = await fetch(proxyUrl + encodeURIComponent(`https://api.spotify.com/v1/audio-features?ids=${ids}`), {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.audio_features) {
            let energia = 0, ballabilita = 0, acustica = 0, count = 0;
            
            data.audio_features.forEach(f => {
                if(f) { energia += f.energy; ballabilita += f.danceability; acustica += f.acousticness; count++; }
            });
            
            if(count > 0) {
                energia = Math.round((energia / count) * 100);
                ballabilita = Math.round((ballabilita / count) * 100);
                acustica = Math.round((acustica / count) * 100);

                document.getElementById('vibe-score-container').innerHTML = `
                    <div style="border: 1px solid rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-bottom: 25px; text-align: center;">
                        <h3 style="margin-top:0; color:#1DB954; font-size: 18px;">📊 Analisi del tuo Vibe</h3>
                        <p style="margin:0; font-size: 14px;">⚡ Energia: <b>${energia}%</b> | 🕺 Ballabilità: <b>${ballabilita}%</b> | 🎸 Acustica: <b>${acustica}%</b></p>
                    </div>`;
            }
        }
    } catch (e) { console.error("Errore Vibe Score:", e); }
}

// --- FEATURE 3: CREA PLAYLIST ---
const btnPlaylist = document.getElementById('btn-playlist');
if (btnPlaylist) {
    btnPlaylist.addEventListener('click', async () => {
        const token = localStorage.getItem('access_token');
        if (!token || !window.canzoniSalvatePerPlaylist) return;
        
        btnPlaylist.innerText = "Creazione...";
        const proxyUrl = 'https://corsproxy.io/?';

        try {
            // 1. Ottieni ID dell'utente
            const meRes = await fetch(proxyUrl + encodeURIComponent('https://api.spotify.com/v1/me'), {
                headers: { Authorization: `Bearer ${token}` }
            });
            const meData = await meRes.json();
            const userId = meData.id;

            // 2. Crea la Playlist vuota
            const createRes = await fetch(proxyUrl + encodeURIComponent(`https://api.spotify.com/v1/users/${userId}/playlists`), {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: "VibeCheck Top 50 🎶", description: "Generata automaticamente da VibeCheck", public: true })
            });
            const playlistData = await createRes.json();

            // 3. Riempi la playlist con le canzoni
            await fetch(proxyUrl + encodeURIComponent(`https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`), {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ uris: window.canzoniSalvatePerPlaylist })
            });

            btnPlaylist.innerText = "✅ Playlist Creata!";
            setTimeout(() => { btnPlaylist.innerText = "Genera Playlist"; }, 3000);
        } catch (e) {
            console.error("Errore Playlist:", e);
            btnPlaylist.innerText = "❌ Errore";
        }
    });
}

// --- FEATURE 4: DOWNLOAD PER INSTAGRAM ---
const btnExport = document.getElementById('btn-export');
if (btnExport) {
    btnExport.addEventListener('click', () => {
        const mainContainer = document.querySelector('.login-container');
        
        // Nascondiamo temporaneamente i bottoni così non compaiono nella foto per Instagram
        document.getElementById('filters-container').style.display = 'none';
        document.getElementById('actions-container').style.display = 'none';

        html2canvas(mainContainer, { backgroundColor: "#121212", scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'VibeCheck_Story.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            // Ripristiniamo i bottoni
            document.getElementById('filters-container').style.display = 'flex';
            document.getElementById('actions-container').style.display = 'flex';
        });
    });
}

// --- EVENTI FILTRI TEMPORALI ---
const btnShort = document.getElementById('btn-short');
const btnMedium = document.getElementById('btn-medium');
const btnLong = document.getElementById('btn-long');

if (btnShort) btnShort.addEventListener('click', () => ottieniStatistiche('short_term'));
if (btnMedium) btnMedium.addEventListener('click', () => ottieniStatistiche('medium_term'));
if (btnLong) btnLong.addEventListener('click', () => ottieniStatistiche('long_term'));

// --- STAMPA A SCHERMO (Dati) ---
function mostraDatiSuSchermo(artisti, canzoni) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    container.innerHTML = ''; 
    
    container.innerHTML += '<h2>Top Artisti:</h2>';
    if (artisti && artisti.length > 0) {
        artisti.forEach((artista, index) => {
            const immagineUrl = artista.images && artista.images.length > 0 ? artista.images[0].url : '';
            const generi = artista.genres && artista.genres.length > 0 ? artista.genres.join(', ') : 'Nessun genere specifico';
            const linkSpotify = artista.external_urls ? artista.external_urls.spotify : '#';
            const idTendina = `dettaglio-artista-${index}`;
            
            container.innerHTML += `
                <div style="margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; cursor: pointer;" onclick="apriChiudiDettagli('${idTendina}')">
                        <img src="${immagineUrl}" width="50" height="50" style="border-radius: 50%; object-fit: cover; margin-right: 15px;">
                        <p style="margin: 0; flex-grow: 1;"><b>${index + 1}. ${artista.name}</b></p>
                        <span style="font-size: 12px; color: gray;">Espandi ▼</span>
                    </div>
                    <div id="${idTendina}" style="display: none; margin-top: 10px; margin-left: 65px;">
                        <p style="margin: 5px 0; font-size: 14px; text-transform: capitalize;"><b>Generi:</b> ${generi}</p>
                        <a href="${linkSpotify}" target="_blank" style="color: #1DB954; font-size: 14px; text-decoration: none; font-weight: bold;">Apri Artista ↗</a>
                    </div>
                </div>`;
        });
    }
    
    container.innerHTML += '<h2 style="margin-top: 30px;">Top Canzoni:</h2>';
    if (canzoni && canzoni.length > 0) {
        canzoni.forEach((canzone, index) => {
            const immagineUrl = canzone.album && canzone.album.images.length > 0 ? canzone.album.images[0].url : '';
            const linkCanzone = canzone.external_urls ? canzone.external_urls.spotify : '#';
            const nomeArtista = canzone.artists && canzone.artists.length > 0 ? canzone.artists[0].name : 'Artista sconosciuto';
            
            const idTendina = `dettaglio-canzone-${index}`;
            
            container.innerHTML += `
                <div style="margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; cursor: pointer;" onclick="apriChiudiDettagli('${idTendina}')">
                        <img src="${immagineUrl}" width="50" height="50" style="object-fit: cover; margin-right: 15px;">
                        <div style="flex-grow: 1;">
                            <p style="margin: 0;"><b>${index + 1}. ${canzone.name}</b></p>
                            <p style="margin: 0; font-size: 14px; color: gray;">${nomeArtista}</p>
                        </div>
                        <span style="font-size: 12px; color: gray;">Espandi ▼</span>
                    </div>
                    <div id="${idTendina}" style="display: none; margin-top: 10px; margin-left: 65px;">
                        <a href="${linkCanzone}" target="_blank" style="color: #1DB954; font-size: 14px; text-decoration: none; font-weight: bold;">Ascolta su Spotify ↗</a>
                    </div>
                </div>`;
        });
    }
}

function apriChiudiDettagli(idSezione) {
    const sezione = document.getElementById(idSezione);
    if (!sezione) return;
    sezione.style.display = (sezione.style.display === 'none') ? 'block' : 'none';
}