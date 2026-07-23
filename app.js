// 1. I tuoi dati
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
            code_challenge: codeChallenge,
            show_dialog: 'true' // <-- Questo forza Spotify a chiederti di nuovo i permessi corretti per la playlist!
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
            
            // Il messaggio che volevi cambiare!
            alert("Login done! 🎧"); 
            
            ottieniStatistiche();
        }
    } catch (error) {
        console.error("Network Error:", error);
    }
}

// --- FUNZIONI API PRINCIPALI ---
async function ottieniStatistiche(timeRange = 'short_term') {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    document.getElementById('filters-container').style.display = 'flex';
    document.getElementById('actions-container').style.display = 'flex';
    document.getElementById('stats-container').innerHTML = '<p>Loading data in progress...</p>';

    try {
        const proxyUrl = 'https://corsproxy.io/?';

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

        window.canzoniSalvatePerPlaylist = datiCanzoni.items.map(c => c.uri);

        mostraDatiSuSchermo(datiArtisti.items, datiCanzoni.items);
        
        ottieniLiveStatus(token, proxyUrl);
        calcolaVibeScore(datiCanzoni.items, token, proxyUrl);

    } catch (error) {
        console.error("Errore API:", error);
    }
}

// --- LIVE STATUS ---
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
                        🎧 Now listening: ${data.item.name} - ${data.item.artists[0].name}
                    </div>`;
            }
        } else {
            document.getElementById('live-status-container').innerHTML = '';
        }
    } catch (e) { console.error("Errore Live Status:", e); }
}

// --- VIBE SCORE ---
async function calcolaVibeScore(canzoni, token, proxyUrl) {
    if (!canzoni || canzoni.length === 0) return;
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
                        <p style="margin:0; font-size: 14px;">⚡ Energy: <b>${energia}%</b> | 🕺 Danceability: <b>${ballabilita}%</b> | 🎸 Acoustics: <b>${acustica}%</b></p>
                    </div>`;
            }
        }
    } catch (e) { console.error("Error Vibe Score:", e); }
}

// --- CREA PLAYLIST (Risolto proxy POST) ---
const btnPlaylist = document.getElementById('btn-playlist');
if (btnPlaylist) {
    btnPlaylist.addEventListener('click', async () => {
        const token = localStorage.getItem('access_token');
        if (!token || !window.canzoniSalvatePerPlaylist) return;
        
        btnPlaylist.innerText = "Creation in progress...";

        try {
            // Chiamata DIRETTA a Spotify (Senza proxy)
            const meRes = await fetch('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const meData = await meRes.json();
            const userId = meData.id;

            const createRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: "VibeCheck Top 50 🎶", description: "Automatic generation by VibeCheck", public: true })
            });
            const playlistData = await createRes.json();

            await fetch(`https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ uris: window.canzoniSalvatePerPlaylist })
            });

            btnPlaylist.innerText = "✅ Playlist Created!";
            setTimeout(() => { btnPlaylist.innerText = "Generate Playlist"; }, 3000);
        } catch (e) {
            console.error("Playlist Error:", e);
            alert("There was a problem with the creation of the playlist. Check the console.");
            btnPlaylist.innerText = "❌ Error";
        }
    });
}

// --- DOWNLOAD PER INSTAGRAM (Ora solo Top 5!) ---
const btnExport = document.getElementById('btn-export');
if (btnExport) {
    btnExport.addEventListener('click', () => {
        const mainContainer = document.querySelector('.login-container');
        
        // 1. Nascondi bottoni
        document.getElementById('filters-container').style.display = 'none';
        document.getElementById('actions-container').style.display = 'none';

        // 2. Nascondi tutti gli elementi con indice dal 5 in poi (che corrispondono al 6° posto in classifica)
        const elementiClassifica = document.querySelectorAll('.stat-item');
        elementiClassifica.forEach(el => {
            if (parseInt(el.getAttribute('data-index')) >= 5) {
                el.style.display = 'none';
            }
        });

        // 3. Fai la "foto" della pagina accorciata
        html2canvas(mainContainer, { backgroundColor: "#121212", scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'VibeCheck_Story.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            // 4. Fai riapparire bottoni e l'intera classifica
            document.getElementById('filters-container').style.display = 'flex';
            document.getElementById('actions-container').style.display = 'flex';
            elementiClassifica.forEach(el => {
                el.style.display = 'block'; // Ripristina tutti i 50
            });
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

// --- STAMPA A SCHERMO ---
function mostraDatiSuSchermo(artisti, canzoni) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    container.innerHTML = ''; 
    
    container.innerHTML += '<h2>Top Artists:</h2>';
    if (artisti && artisti.length > 0) {
        artisti.forEach((artista, index) => {
            const immagineUrl = artista.images && artista.images.length > 0 ? artista.images[0].url : '';
            const generi = artista.genres && artista.genres.length > 0 ? artista.genres.join(', ') : 'No specific music gender';
            const linkSpotify = artista.external_urls ? artista.external_urls.spotify : '#';
            const idTendina = `artist-detail-${index}`;
            
            // Nota l'aggiunta di class="stat-item" e data-index
            container.innerHTML += `
                <div class="stat-item" data-index="${index}" style="margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; cursor: pointer;" onclick="apriChiudiDettagli('${idTendina}')">
                        <img src="${immagineUrl}" width="50" height="50" style="border-radius: 50%; object-fit: cover; margin-right: 15px;">
                        <p style="margin: 0; flex-grow: 1;"><b>${index + 1}. ${artista.name}</b></p>
                        <span style="font-size: 12px; color: gray;">Expand ▼</span>
                    </div>
                    <div id="${idTendina}" style="display: none; margin-top: 10px; margin-left: 65px;">
                        <p style="margin: 5px 0; font-size: 14px; text-transform: capitalize;"><b>Genres:</b> ${generi}</p>
                        <a href="${linkSpotify}" target="_blank" style="color: #1DB954; font-size: 14px; text-decoration: none; font-weight: bold;">Open Artist ↗</a>
                    </div>
                </div>`;
        });
    }
    
    container.innerHTML += '<h2 style="margin-top: 30px;">Top Songs:</h2>';
    if (canzoni && canzoni.length > 0) {
        canzoni.forEach((canzone, index) => {
            const immagineUrl = canzone.album && canzone.album.images.length > 0 ? canzone.album.images[0].url : '';
            const linkCanzone = canzone.external_urls ? canzone.external_urls.spotify : '#';
            const nomeArtista = canzone.artists && canzone.artists.length > 0 ? canzone.artists[0].name : 'Unknown artist';
            const idTendina = `song-detail-${index}`;
            
            // Stessa cosa qui: class="stat-item" e data-index
            container.innerHTML += `
                <div class="stat-item" data-index="${index}" style="margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; cursor: pointer;" onclick="apriChiudiDettagli('${idTendina}')">
                        <img src="${immagineUrl}" width="50" height="50" style="object-fit: cover; margin-right: 15px;">
                        <div style="flex-grow: 1;">
                            <p style="margin: 0;"><b>${index + 1}. ${canzone.name}</b></p>
                            <p style="margin: 0; font-size: 14px; color: gray;">${nomeArtista}</p>
                        </div>
                        <span style="font-size: 12px; color: gray;">Expand ▼</span>
                    </div>
                    <div id="${idTendina}" style="display: none; margin-top: 10px; margin-left: 65px;">
                        <a href="${linkCanzone}" target="_blank" style="color: #1DB954; font-size: 14px; text-decoration: none; font-weight: bold;">Listen on Spotify ↗</a>
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