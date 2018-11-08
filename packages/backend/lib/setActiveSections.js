
const setActiveSections = (activeSections, status, settings) => {
    // set active sections and a normalized array as well
    status.activeSections = activeSections;

    // set a normalized value based on previous captures
    const normalizeValue = settings.sectionIdentification.normalizationValue;

    // add the newest to the history
    status.lastActiveSections.unshift(activeSections);

    if (status.lastActiveSections.length >= normalizeValue) {
        // we have enough captures to make a normalized result
        if (status.lastActiveSections.length > normalizeValue) {
            // Remove entries larger than the normalization value
            status.lastActiveSections.splice(normalizeValue);
        }

        // get occurence list of all active sections
        const sectionsOccurenceCount = status.lastActiveSections.reduce((prev, currSections) => {
            return currSections.reduce((prev, currSectionNumber) => {
                prev[currSectionNumber] = (prev[currSectionNumber] || 0) + 1;
                return prev;
            }, prev);
        }, {});

        // find the occurences that are consistently present in all last active sections
        const alwaysPresentSections = [];
        Object.keys(sectionsOccurenceCount).forEach(sectionName => {
            if (sectionsOccurenceCount[sectionName] === normalizeValue) {
                alwaysPresentSections.push(sectionName);
            }
        });

        // remove sections that are completely gone from the last X captures
        status.normalizedActiveSections = status.normalizedActiveSections.filter(
            normalizedSection => {
                if (!sectionsOccurenceCount[normalizedSection]) {
                    // old normalized section is not present at all anymore
                    return false;
                }
                return true;
            }
        );

        // add the always present sections in
        alwaysPresentSections.forEach(alwaysPresentSection => {
            if (!status.normalizedActiveSections.includes(alwaysPresentSection)) {
                // section is not previously in the array, add it in
                status.normalizedActiveSections.push(alwaysPresentSection);
            }
        });
    }

    // debugging
    // console.log(
    //     "Normalized: " +
    //         JSON.stringify(status.normalizedActiveSections) +
    //         ", Raw: " +
    //         JSON.stringify(status.activeSections)
    // );
};

module.exports = setActiveSections;