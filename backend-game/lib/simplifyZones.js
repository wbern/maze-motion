module.exports = zones => {
    // group zones that are next to each other into bigger zones
    const simplifyAxis = (main, secondary) => {
        for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex++) {
            const zone = zones[zoneIndex];
            const nextZone = zones[zoneIndex + 1];

            if (nextZone) {
                if (
                    // same secondary axis coords?
                    nextZone[secondary.axisName] ===
                        zone[secondary.axisName] &&
                    // same secondary axis size?
                    nextZone[secondary.sizeName] ===
                    zone[secondary.sizeName] &&
                    // same ending main axis coord as next zone's starting main axis coord?
                    zone[main.axisName] + zone[main.sizeName] === nextZone[main.axisName]
                ) {
                    // next zone has matching y
                    zone[main.sizeName] += nextZone[main.sizeName];
                    zones.splice(zoneIndex + 1, 1);
                    // re-iterate same index again
                    zoneIndex--;
                }
            }
        }
    };

    const xAxis = {axisName: "x", sizeName: "width"};
    const yAxis = {axisName: "y", sizeName: "height"};

    simplifyAxis(yAxis, xAxis);
    simplifyAxis(xAxis, yAxis); // the one to blame

    return zones;
};
