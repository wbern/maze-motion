module.exports = (zones, sourceResolution, targetResolution) => {
    // reduce zones resolution
    const heightDivider = sourceResolution.height / targetResolution.height;
    const widthDivider = sourceResolution.width / targetResolution.width;
    return zones.map(zone => {
        const newZone = Object.assign({}, zone);
        newZone.x /= widthDivider;
        newZone.width /= widthDivider;
        newZone.y /= heightDivider;
        newZone.height /= heightDivider;

        return newZone;
    });
};
