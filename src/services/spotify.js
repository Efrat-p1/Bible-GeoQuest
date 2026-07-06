let spotifyAccessToken = null;

async function getSpotifyToken() {
    if (spotifyAccessToken) return spotifyAccessToken;
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret || clientId === 'your_client_id_here') {
        console.warn("Spotify credentials not set in .env.local");
        return null;
    }
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
            },
            body: 'grant_type=client_credentials'
        });
        const data = await response.json();
        spotifyAccessToken = data.access_token;
        return spotifyAccessToken;
    } catch (e) {
        console.error("Failed to get Spotify token", e);
        return null;
    }
}

// Array shuffling utility
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export async function embedSpotifyTrack(query, container) {
    container.innerHTML = '<p class="spotify-loading">מחפש שירים מתאימים...</p>';
    const token = await getSpotifyToken();
    if (!token) {
        container.innerHTML = '<p class="spotify-error">שגיאת התחברות לספוטיפיי.</p>';
        return;
    }
    
    try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        container.innerHTML = '';
        
        if (data.tracks && data.tracks.items.length > 0) {
            let items = data.tracks.items;
            shuffleArray(items);
            const selectedItems = items.slice(0, 1);
            
            selectedItems.forEach(track => {
                const trackId = track.id;
                const iframe = document.createElement('iframe');
                iframe.src = `https://open.spotify.com/embed/track/${trackId}`;
                iframe.width = "100%";
                iframe.height = "80";
                iframe.frameBorder = "0";
                iframe.allowTransparency = "true";
                iframe.allow = "encrypted-media";
                iframe.style.marginBottom = "10px";
                container.appendChild(iframe);
            });
        } else {
            container.innerHTML = '<p class="spotify-no-results">לא מצאנו שירים מתאימים... 🎵</p>';
        }
    } catch (e) {
        console.error("Failed to search Spotify", e);
        container.innerHTML = '<p class="spotify-error">שגיאה בחיפוש השירים.</p>';
    }
}
