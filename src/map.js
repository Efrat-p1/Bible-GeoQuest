import { gameStations } from './data/stations.js';

let map;
let markersLayer;
let homeMarkerLayer;
export let activeMarkers = {};

// Array shuffling utility
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function initLeafletMap() {
    map = L.map('map', {
        center: [31.8, 35.0],
        zoom: 8,
        minZoom: 7,
        maxZoom: 13,
        maxBounds: [
            [27.5, 33.0], 
            [34.0, 36.5]
        ]
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

export function renderMapPins(optionsArray, onPinClickCallback) {
    markersLayer.clearLayers();
    activeMarkers = {}; // clear active markers dict
    
    optionsArray.forEach((station) => {
        const customIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `
                <div class="marker-text">${station.placeNameHebrew}</div>
                <div class="marker-circle"></div>
            `,
            iconSize: [120, 60],
            iconAnchor: [60, 60]
        });

        const marker = L.marker(station.coordinates, { icon: customIcon }).addTo(markersLayer);
        marker.on('click', () => onPinClickCallback(station.id));
        
        // Save reference for reveal logic
        activeMarkers[station.id] = marker;
    });
    
    // Pan to fit the bounds of the 5 pins nicely
    const group = L.featureGroup(markersLayer.getLayers());
    map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 10 });
}

export function updateHomeMarker(coords) {
    // Remove existing home marker if exists
    if (homeMarkerLayer && map.hasLayer(homeMarkerLayer)) {
        map.removeLayer(homeMarkerLayer);
    }

    const homeIcon = L.divIcon({
        className: 'custom-home-marker-wrapper',
        html: `<div class="custom-home-marker animate-drop">🏠</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    homeMarkerLayer = L.marker(coords, { icon: homeIcon }).addTo(map);
    
    // Pan to show the home and animate
    map.setView(coords, 10, { animate: true });
}

export function clearMapPins() {
    markersLayer.clearLayers();
}

export function highlightMarkerAndPan(stationId, coordinates) {
    const correctMarker = activeMarkers[stationId];
    if (correctMarker) {
        // Add highlight class to the marker's DOM element
        const iconElement = correctMarker.getElement();
        if (iconElement) {
            iconElement.classList.add('highlight-marker');
        }
        
        // Pan map slightly towards the correct answer to make it obvious
        map.setView(coordinates, 10, { animate: true });
    }
}
