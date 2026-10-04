// 1. CloudKit JS Konfiguration
CloudKit.configure({
    containers: [{
        containerIdentifier: 'iCloud.CarastoSoft.ChromaWorld',
        apiTokenAuth: {
            apiToken: 'DEIN_CLOUDKIT_API_TOKEN_HIER'
        },
        environment: 'development' // Im Release später auf 'production' umstellen
    }]
});

const container = CloudKit.getDefaultContainer();
const publicDB = container.publicDatabase;

// 2. MapKit JS Initialisierung
mapkit.init({
    authorizationCallback: function(done) {
        // Hier deinen generierten MapKit JS JWT-Token eintragen
        done("DEIN_MAPKIT_JS_TOKEN");
    }
});

const map = new mapkit.Map("map", {
    center: new mapkit.Coordinate(50.0, 10.0), // Start-Position (z.B. Deutschland)
    zoom: 5
});

// 3. MapTile-Records aus CloudKit laden & Zeichnen
async function fetchAndRenderMapTiles() {
    const query = { recordType: 'MapTile' };
    
    try {
        const response = await publicDB.performQuery(query);
        const records = response.records;
        
        records.forEach(record => {
            const tileID = record.fields.tileID.value;
            const hex = record.fields.dominantHex.value;
            
            // Bounding Box aus Geohash berechnen
            const bbox = decodeGeohashToBBox(tileID);
            
            // Polygon für Kachel erstellen
            const points = [
                new mapkit.Coordinate(bbox.minLat, bbox.minLon),
                new mapkit.Coordinate(bbox.maxLat, bbox.minLon),
                new mapkit.Coordinate(bbox.maxLat, bbox.maxLon),
                new mapkit.Coordinate(bbox.minLat, bbox.maxLon)
            ];
            
            const overlay = new mapkit.PolygonOverlay(points, {
                style: new mapkit.Style({
                    fillColor: hex,
                    fillOpacity: 0.6,
                    strokeColor: "#FFFFFF",
                    lineWidth: 1
                })
            });
            
            // Kachel-Daten an Overlay binden für Klick-Events
            overlay.recordData = record.fields;
            map.addOverlay(overlay);
        });
    } catch (error) {
        console.error("Fehler beim Laden der CloudKit-Daten:", error);
    }
}

// 4. Klick-Event auf Kachel (Detailansicht / Stat-Sheet)
map.addEventListener("select", function(event) {
    if (event.overlay && event.overlay.recordData) {
        const fields = event.overlay.recordData;
        
        document.getElementById("hex-code").innerText = fields.dominantHex.value.toUpperCase();
        document.getElementById("color-name").innerText = fields.colorName?.value || "Dominant Color";
        
        // JSON-ColorCounts dekodieren & Top 10 auflisten
        if (fields.colorCountsData) {
            const counts = JSON.parse(fields.colorCountsData.value);
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            document.getElementById("total-pixels").innerText = total;
        }
        
        document.getElementById("detail-sheet").classList.remove("hidden");
    }
});

// Starten sobald Map bereit ist
mapkit.addEventListener("configuration-change", () => {
    fetchAndRenderMapTiles();
});
