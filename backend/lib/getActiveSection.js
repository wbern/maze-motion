module.exports = (sections, diffMat) => {
    const isWithinSection = (section, coords) =>
        coords.x > section.x &&
        coords.x < section.x + section.width &&
        (coords.y > section.y && coords.y < section.y + section.height);

    const matches = [];
    // set match count in sections
    diffMat.findNonZero().forEach(coords => {
        sections.forEach((section, sectionIndex) => {
            if (isWithinSection(section, coords)) {
                matches[sectionIndex] = (matches[sectionIndex] || 0) + 1;
            }
        });
    });

    let highestIndex = matches.reduce((highestIndex, current, currentIndex, arr) => {
        if (current && current > arr[highestIndex]) {
            return currentIndex;
        } else {
            return highestIndex;
        }
    }, 0);

    return highestIndex;
}