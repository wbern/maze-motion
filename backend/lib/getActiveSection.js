const getActiveSections = require("./getActiveSections");

module.exports = (sections, diffMat) => {
    return getActiveSections(sections, diffMat).then(sectionMatches => {
        // get section with highest amount of matches
        const highestIndex = sectionMatches.reduce((highestIndex, current, currentIndex, arr) => {
            if (current && current > (arr[highestIndex] || 0)) {
                return currentIndex;
            } else {
                return highestIndex;
            }
        }, 0);

        return highestIndex;
    });
};
