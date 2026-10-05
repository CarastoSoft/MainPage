// 1. Geohash Decoder & Zoom-Berechnung
function decodeGeohashToBBox(geohash) {
    const BITS = [16, 8, 4, 2, 1];
    const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
    let isEven = true;
    let latMin = -90.0, latMax = 90.0;
    let lonMin = -180.0, lonMax = 180.0;

    for (let i = 0; i < geohash.length; i++) {
        const c = geohash[i];
        const cd = BASE32.indexOf(c);
        if (cd === -1) continue;
        for (let j = 0; j < 5; j++) {
            const mask = BITS[j];
            if (isEven) {
                const lonMid = (lonMin + lonMax) / 2;
                if ((cd & mask) !== 0) lonMin = lonMid;
                else lonMax = lonMid;
            } else {
                const latMid = (latMin + latMax) / 2;
                if ((cd & mask) !== 0) latMin = latMid;
                else latMax = latMid;
            }
            isEven = !isEven;
        }
    }
    return { minLat: latMin, maxLat: latMax, minLon: lonMin, maxLon: lonMax };
}

// 2. State Management
let loadedTilesRecords = [];
let overlaysMap = new Map(); // tileID -> Overlay
let showColors = true;
let selectedTileID = null;
let currentZoomLevel = 1;

function getZoomLevelFromAltitude(altitude) {
    if (altitude > 10000000) return 1;
    if (altitude > 3000000) return 2;
    if (altitude > 800000) return 3;
    if (altitude > 150000) return 4;
    return 5;
}

// 3. CloudKit Konfiguration
CloudKit.configure({
    containers: [{
        containerIdentifier: 'iCloud.CarastoSoft.ChromaWorld',
        apiTokenAuth: {
            apiToken: 'c91102546b16164dfd9f890a378d5fca37e08fb558b63b1b60eb57f2dd93d9b6'
        },
        environment: 'development'
    }]
});

const container = CloudKit.getDefaultContainer();
const publicDB = container.publicCloudDatabase;

// 4. MapKit JS Initialisierung
mapkit.init({
    authorizationCallback: function(done) {
        done("eyJraWQiOiJNWDJCUzU4MjNWIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJHTjVBQzVUVDczIiwiaWF0IjoxNzkxMTMxMDQ3LCJvcmlnaW4iOiJjYXJhc3Rvc29mdC5jb20iLCJzY29wZSI6Im1hcGtpdF9qcyJ9.T685nKj2NkXG_YJ7WQYCeo8PXStW_KJpgFf--mfNhJs4I701IAkT3oA9Mjq3qyrK903o65UP4aky-ltN2Ke8Mw");
    }
});

// 5. Map Instanz mit gesperrter Rotation & 3D-Pitch
const map = new mapkit.Map("map", {
    center: new mapkit.Coordinate(49.9738, 9.1478),
    cameraDistance: 20000000,
    mapType: mapkit.Map.MapTypes.Hybrid,
    isRotationEnabled: false, // <-- Blockiert die Kartendrehung komplett
    pitch: 45,                // <-- Leicht gekippte 3D-Perspektive
    showsPointsOfInterest: true,
    showsCompass: mapkit.FeatureVisibility.Hidden,
    showsZoomControl: false,
    showsMapTypeControl: false,
    showsUserLocationControl: false
});

// 6. Map Event Listener
map.addEventListener("region-change-end", () => {
    updateVisibleOverlays();
});

map.addEventListener("select", (event) => {
    if (event.overlay && event.overlay.tileID) {
        selectTile(event.overlay.tileID);
    }
});

map.addEventListener("single-tap", (event) => {
    if (!event.overlay) {
        selectTile(null);
    }
});

// 7. UI Steuerung (Kartenstile)
document.querySelectorAll(".picker-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.querySelectorAll(".picker-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        
        const style = e.target.getAttribute("data-style");
        if (style === "hybrid") {
            map.mapType = mapkit.Map.MapTypes.Hybrid; // Hybrid = Satellit + Straßennamen & Orte
            map.showsPointsOfInterest = true;
        } else if (style === "satellite") {
            map.mapType = mapkit.Map.MapTypes.Imagery; // Imagery = Reiner Satellit
            map.showsPointsOfInterest = false;        // Deaktiviert Beschriftungen & Ortsnamen
        } else if (style === "standard") {
            map.mapType = mapkit.Map.MapTypes.Standard;
            map.showsPointsOfInterest = true;
        }
    });
});

document.getElementById("toggle-colors-btn").addEventListener("click", () => {
    showColors = !showColors;
    const btn = document.getElementById("toggle-colors-btn");
    btn.style.opacity = showColors ? "1" : "0.5";
    updateVisibleOverlays();
});

document.getElementById("close-sheet-btn").addEventListener("click", () => {
    selectTile(null);
});

// 8. Sichtbarkeit der Kacheln nach Zoom-Level steuern
function updateVisibleOverlays() {
    currentZoomLevel = getZoomLevelFromAltitude(map.cameraDistance);
    
    overlaysMap.forEach((overlay, tileID) => {
        const isCorrectZoom = tileID.length === currentZoomLevel;
        overlay.visible = showColors && isCorrectZoom;
    });
}

// 9. Tile Selection & Sheet Rendern
function selectTile(tileID) {
    if (selectedTileID === tileID) return;

    if (selectedTileID && overlaysMap.has(selectedTileID)) {
        const oldOverlay = overlaysMap.get(selectedTileID);
        oldOverlay.style = new mapkit.Style({
            fillColor: oldOverlay.dominantHex,
            fillOpacity: 0.6,
            strokeColor: oldOverlay.dominantHex,
            lineWidth: 1.5
        });
    }

    selectedTileID = tileID;
    const sheet = document.getElementById("detail-sheet");

    if (!tileID) {
        sheet.classList.add("hidden");
        return;
    }

    const currentOverlay = overlaysMap.get(tileID);
    if (currentOverlay) {
        currentOverlay.style = new mapkit.Style({
            fillColor: currentOverlay.dominantHex,
            fillOpacity: 0.85,
            strokeColor: "#FFFFFF",
            lineWidth: 3.0
        });
    }

    const record = loadedTilesRecords.find(r => r.fields.tileID && r.fields.tileID.value === tileID);
    if (record) {
        renderDetailSheet(record);
        sheet.classList.remove("hidden");
    }
}

function renderDetailSheet(record) {
    const dominantHex = (record.fields.dominantHex ? record.fields.dominantHex.value : "#FFFFFF").toUpperCase();
    
    document.getElementById("sheet-hex-code").textContent = dominantHex;
    document.getElementById("sheet-color-preview").style.backgroundColor = dominantHex;
    document.getElementById("sheet-color-name").textContent = dominantHex;

    fetch(`https://www.thecolorapi.com/id?hex=${dominantHex.replace('#', '')}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.name) {
                document.getElementById("sheet-color-name").textContent = data.name.value;
            }
        })
        .catch(() => {});

    let colorCounts = {};
    let totalPixels = 0;

    if (record.fields.colorCountsData && record.fields.colorCountsData.value) {
        try {
            const jsonStr = atob(record.fields.colorCountsData.value);
            colorCounts = JSON.parse(jsonStr);
            totalPixels = Object.values(colorCounts).reduce((a, b) => a + b, 0);
        } catch (e) {
            console.error("JSON Parse Error:", e);
        }
    }

    document.getElementById("sheet-total-pixels").textContent = totalPixels;

    const sortedColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const listContainer = document.getElementById("sheet-colors-list");
    listContainer.innerHTML = "";

    const countSub = document.getElementById("sheet-color-count-sub");
    const totalUnique = Object.keys(colorCounts).length;
    countSub.textContent = totalUnique > 10 ? `Top 10 von ${totalUnique}` : "";

    sortedColors.forEach(([hex, count]) => {
        const percentage = totalPixels > 0 ? ((count / totalPixels) * 100).toFixed(1) : "0.0";
        const chip = document.createElement("div");
        chip.className = "color-chip";
        chip.innerHTML = `
            <div class="chip-box" style="background-color: ${hex}"></div>
            <span class="monospaced">${hex.toUpperCase()}</span>
            <strong style="color: rgba(255,255,255,0.6)">${percentage}%</strong>
        `;
        listContainer.appendChild(chip);
    });
}

// 10. CloudKit Records laden
async function fetchAndRenderMapTiles() {
    const query = { recordType: 'MapTile' };
    
    try {
        const response = await publicDB.performQuery(query);
        if (!response || !response.records) return;

        loadedTilesRecords = response.records;
        
        loadedTilesRecords.forEach(record => {
            const tileID = record.fields.tileID ? record.fields.tileID.value : null;
            const hex = record.fields.dominantHex ? record.fields.dominantHex.value : "#007AFF";
            
            if (!tileID) return;

            const bbox = decodeGeohashToBBox(tileID);
            const points = [
                new mapkit.Coordinate(bbox.maxLat, bbox.minLon),
                new mapkit.Coordinate(bbox.maxLat, bbox.maxLon),
                new mapkit.Coordinate(bbox.minLat, bbox.maxLon),
                new mapkit.Coordinate(bbox.minLat, bbox.minLon)
            ];
            
            const overlay = new mapkit.PolygonOverlay(points, {
                style: new mapkit.Style({
                    fillColor: hex,
                    fillOpacity: 0.6,
                    strokeColor: hex,
                    lineWidth: 1.5
                })
            });
            
            overlay.tileID = tileID;
            overlay.dominantHex = hex;
            
            overlaysMap.set(tileID, overlay);
            map.addOverlay(overlay);
        });

        updateVisibleOverlays();

    } catch (error) {
        console.error("Fehler beim Laden aus CloudKit:", error);
    }
}

if (mapkit.isInitialized) {
    fetchAndRenderMapTiles();
} else {
    mapkit.addEventListener("configuration-change", () => {
        fetchAndRenderMapTiles();
    }, { once: true });
}
