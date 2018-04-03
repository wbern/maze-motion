module.exports = (sections, diffMat) => {
    const minThresh = 500;
    const minTimesHigherThanOtherSections = 5;

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
            // sections.forEach((section, sectionIndex) => {
            //     section.forEach(area => {
            //         if (isWithinSection(area, coords)) {
            //             sectionMatches[sectionIndex] = (sectionMatches[sectionIndex] || 0) + 1;
            //         }
            //     });
            // });
        });

        // get section with highest amount of matches
        const highestIndex = sectionMatches.reduce((highestIndex, current, currentIndex, arr) => {
            if (current && current > (arr[highestIndex] || 0)) {
                return currentIndex;
            } else {
                return highestIndex;
            }
        }, 0);

        // if section wasn't active enough, return null
        if (sectionMatches[highestIndex] < minThresh) {
            resolve(null);
        }

        // if section wasn't active enough to other sections, return null
        if (
            sectionMatches.some(
                (matchCount, matchIndex) =>
                    matchCount > sectionMatches[highestIndex] / minTimesHigherThanOtherSections &&
                    matchIndex !== highestIndex
            )
        ) {
            resolve(null);
        }

        resolve(highestIndex);
    });
};
