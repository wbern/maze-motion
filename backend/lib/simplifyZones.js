module.exports = (zones) => {
    // group zones that are next to each other into bigger zones
    const simplifyAxis = (axisName, sizeName, otherAxisName) => {
        for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex++) {
            const zone = zones[zoneIndex];
            const nextZone = zones[zoneIndex + 1];

            if (nextZone) {
                if (
                    nextZone[otherAxisName] === zone[otherAxisName] &&
                    zone[axisName] + zone[sizeName] === nextZone[axisName]
                ) {
                    // next zone has matching y
                    zone[sizeName] += nextZone[sizeName];
                    zones.splice(zoneIndex + 1, 1);
                    // re-iterate same index again
                    zoneIndex--;
                }
            }
        }
    };

    simplifyAxis("y", "height", "x");
    simplifyAxis("x", "width", "y");

    return zones;
};
