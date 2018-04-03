module.exports = zones => {
    // group zones that are next to each other into bigger zones
    const simplifyAxis = (axisName, sizeName) => {
        for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex++) {
            const zone = zones[zoneIndex];
            const nextZone = zones[zoneIndex + 1];

            if (nextZone) {
                if (zone[axisName] + zone[sizeName] === zones[zoneIndex + 1][axisName]) {
                    // next zone has matching y
                    zone[sizeName] += zones[zoneIndex + 1][sizeName];
                    zones.splice(zoneIndex + 1, 1);
                    // re-iterate same index again
                    zoneIndex--;
                }
            }
        }
    };

    simplifyAxis("y", "height");
    simplifyAxis("x", "width");

    return zones;
};
