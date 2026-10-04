// chromaworld/geohash.js
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

function decodeGeohashToBBox(geohash) {
    let isLon = true;
    let maxLat = 90.0, minLat = -90.0;
    let maxLon = 180.0, minLon = -180.0;

    for (let i = 0; i < geohash.length; i++) {
        const c = geohash[i];
        const cd = BASE32.indexOf(c);
        if (cd === -1) continue;

        for (let j = 4; j >= 0; j--) {
            const bit = (cd >> j) & 1;
            if (isLon) {
                const mid = (minLon + maxLon) / 2;
                if (bit === 1) minLon = mid;
                else maxLon = mid;
            } else {
                const mid = (minLat + maxLat) / 2;
                if (bit === 1) minLat = mid;
                else maxLat = mid;
            }
            isLon = !isLon;
        }
    }
    return { minLat, maxLat, minLon, maxLon };
}
