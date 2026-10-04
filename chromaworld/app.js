// 1. CloudKit Konfiguration
CloudKit.configure({
    containers: [{
        containerIdentifier: 'iCloud.CarastoSoft.ChromaWorld',
        apiTokenAuth: {
            apiToken: 'c91102546b16164dfd9f890a378d5fca37e08fb558b63b1b60eb57f2dd93d9b6' // <-- Hier den Token aus Schritt 1 einfügen
        },
        environment: 'development' // Nach dem App Store Release auf 'production' stellen
    }]
});

const publicDB = CloudKit.getDefaultContainer().publicDatabase;

// 2. MapKit JS Initialisierung
mapkit.init({
    authorizationCallback: function(done) {
        done("eyJraWQiOiJKQ0Q1MjdRNTNWIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpYXQiOjE3OTExMjIzMzMsImlzcyI6IkdONUFDNVRUNzMiLCJleHAiOjE4MDY2NzQzMzN9.QWk20ASSvyAd4AiG_CpWW1-1AO8SikNm0vW7NfmlairtTFiRVP0iGFKfuVReSGfUFyrFMKqVgqNUK22472Wtiw"); // <-- Hier deinen generierten MapKit JS Token einfügen
    }
});

const map = new mapkit.Map("map", {
    center: new mapkit.Coordinate(50.1109, 8.6821),
    zoom: 4
});

// 3. MapTiles abfragen & Polygone auf der Karte zeichnen
async function fetchAndRenderMapTiles() {
    const query = { recordType: 'MapTile' };
    
    try {
        const response = await publicDB.performQuery(query);
        const records = response.records;
        
        records.forEach(record => {
            const tileID = record.fields.tileID.value;
            const hex = record.fields.dominantHex.value;
            
            const bbox = decodeGeohashToBBox(tileID);
            
            const points = [
                new mapkit.Coordinate(bbox.minLat, bbox.minLon),
                new mapkit.Coordinate(bbox.maxLat, bbox.minLon),
                new mapkit.Coordinate(bbox.maxLat, bbox.maxLon),
                new mapkit.Coordinate(bbox.minLat, bbox.maxLon)
            ];
            
            const overlay = new mapkit.PolygonOverlay(points, {
                style: new mapkit.Style({
                    fillColor: hex,
                    fillOpacity: 0.65,
                    strokeColor: "#FFFFFF",
                    lineWidth: 1
                })
            });
            
            map.addOverlay(overlay);
        });
    } catch (error) {
        console.error("Fehler beim Laden aus CloudKit:", error);
    }
}

mapkit.addEventListener("configuration-change", () => {
    fetchAndRenderMapTiles();
});
