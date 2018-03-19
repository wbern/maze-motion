module.exports = (sections, diffMat) => {
    const isWithinSection = (area, coords) =>
        coords.x >= area.x &&
        coords.x <= area.x + area.width &&
        (coords.y >= area.y && coords.y <= area.y + area.height);

    const sectionMatches = [];
    // set match count in sections
    diffMat.findNonZero().forEach(coords => {
        sections.forEach((section, sectionIndex) => {
            section.forEach(area => {
                if (isWithinSection(area, coords)) {
                    sectionMatches[sectionIndex] = (sectionMatches[sectionIndex] || 0) + 1;
                }
            });
        });
    });

    // get section with highest amount of matches
    let highestIndex = sectionMatches.reduce((highestIndex, current, currentIndex, arr) => {
        if (current && current > arr[highestIndex]) {
            return currentIndex;
        } else {
            return highestIndex;
        }
    }, 0);

    return highestIndex;
};
