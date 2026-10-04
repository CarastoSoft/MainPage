// 1. Geohash Decoder Hilfsfunktion
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

// 2. CloudKit Konfiguration
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
const publicDB = container.publicDatabase;

// 3. MapKit JS Initialisierung
mapkit.init({
    authorizationCallback: function(done) {
        done("eyJ0eXAiOiJKV1QiLCJraWQiOiJKQ0Q1MjdRNUpWIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJHTjVBQzVUVDczIiwiaWF0IjoxNzkxMTMwNjgzLCJleHAiOjE3OTEyMTcwODMsIm9yaWdpbiI6IiouY2FyYXN0b3NvZnQuY29tIiwic3ViIjoiR041QUM1VFQ3My5tYXBzLmNvbS5jYXJhc3Rvc29mdC5jaHJvbWF3b3JsZCJ9.w2GzJlBH6caH7ecx6c-r4r5QCAp1Wbvl9f3_nYZegzkEnP0zj-O_jO9lLSynnDYcuhFqxP1xS3V5YCV-VK_mcw");
    }
});

const map = new mapkit.Map("map", {
    center: new mapkit.Coordinate(50.1109, 8.6821),
    zoom: 4,
    mapType: mapkit.Map.MapTypes.Standard
});

// 4. MapTiles aus CloudKit laden & rendern
async function fetchAndRenderMapTiles() {
    const query = { recordType: 'MapTile' };
    
    try {
        const response = await publicDB.performQuery(query);
        if (!response || !response.records) return;

        const records = response.records;
        
        records.forEach(record => {
            const tileID = record.fields.tileID ? record.fields.tileID.value : null;
            const hex = record.fields.dominantHex ? record.fields.dominantHex.value : "#007AFF";
            
            if (!tileID) return;

            const bbox = decodeGeohashToBBox(tileID);
            
            // Polygon im Uhrzeigersinn definieren
            const points = [
                new mapkit.Coordinate(bbox.maxLat, bbox.minLon),
                new mapkit.Coordinate(bbox.maxLat, bbox.maxLon),
                new mapkit.Coordinate(bbox.minLat, bbox.maxLon),
                new mapkit.Coordinate(bbox.minLat, bbox.minLon)
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

// MapKit Initialisierungs-Ablauf
if (mapkit.isInitialized) {
    fetchAndRenderMapTiles();
} else {
    mapkit.addEventListener("configuration-change", () => {
        fetchAndRenderMapTiles();
    }, { once: true });
}
