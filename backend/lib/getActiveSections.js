module.exports = (sections, diffMat) => {
    return new Promise(resolve => {
        const isWithinSection = (zone, coords) =>
            coords.x >= zone.x &&
            coords.x <= zone.x + zone.width &&
            (coords.y >= zone.y && coords.y <= zone.y + zone.height);

        const sectionMatches = [];
        // set match count in sections
        diffMat.findNonZero().forEach(coords => {
            Object.keys(sections).forEach(sectionIndex => {
                const section = sections[sectionIndex];

                section.zones.forEach(zone => {
                    if (isWithinSection(zone, coords)) {
                        sectionMatches[sectionIndex] = (sectionMatches[sectionIndex] || 0) + 1;
                    }
                });
            });
        });

        resolve(sectionMatches);
    });
};
