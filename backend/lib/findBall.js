const cv = require("opencv4nodejs");

// const blobDetector = new cv.SimpleBlobDetector(new cv.SimpleBlobDetectorParams());

module.exports = (boardImage, sections, options) => {
    // now try to normalize the flat image to have as many circular holes as possible
    const args = [
        // method: Define the detection method. Currently this is the only one available in OpenCV
        cv.HOUGH_GRADIENT,
        // dp: The inverse ratio of resolution
        1,
        // minDist: Minimum distance between detected centers
        options.houghCircleSettings.minDist,
        // param1: Upper threshold for the internal Canny edge detector
        options.houghCircleSettings.cannyUpperThreshold,
        // param2: Threshold for center detection.
        options.houghCircleSettings.centerDetectionThreshold,
        // minRadius: Minimum radius to be detected. If unknown, put zero as default.
        options.houghCircleSettings.minRadius,
        // maxRadius: Maximum radius to be detected. If unknown, put zero as default
        options.houghCircleSettings.maxRadius
    ];

    // mark a range of grays as completely white, onto the forCirclesMat
    const backgroundMat = boardImage
        // houghCircles requires grayscale
        .cvtColor(cv.COLOR_BGR2GRAY)
        // remove all existing pure-white colorings in the image
        .threshold(254, 255, cv.THRESH_TRUNC)
        .gaussianBlur(
            new cv.Size(options.blurAmount, options.blurAmount),
            options.blurKernel,
            options.blurKernel
        );

    // create mat with relevant grays as white
    let colorFilteredMat = boardImage.cvtColor(cv.COLOR_BGR2HSV_FULL);

    let temp = new cv.Mat(boardImage.rows, boardImage.cols, cv.CV_8U);
    options.ballHSVMasks.forEach(hsvMask => {
        const min = new cv.Vec3(hsvMask.min[0], hsvMask.min[1], hsvMask.min[2]);
        const max = new cv.Vec3(hsvMask.max[0], hsvMask.max[1], hsvMask.max[2]);
        const rangeMask = colorFilteredMat.inRange(min, max);
        temp = colorFilteredMat.copyTo(temp, rangeMask);
    });
    colorFilteredMat = temp.bgrToGray().threshold(1, 255, cv.THRESH_BINARY);

    // let res = blobDetector.detect(colorFilteredMat);
    // cv.drawKeyPoints(colorFilteredMat, res);
    // debugger;
    // cv.imshowWait("", colorFilteredMat);

    // make a mask to filter the grayness to be only within the sections (to not read holes)
    if (sections) {
        const sectionsMask = new cv.Mat(
            boardImage.rows,
            boardImage.cols,
            cv.CV_8U,
            new cv.Vec3(0, 0, 0)
        );
        // really make sure its black (buggy opencv?)
        sectionsMask.drawRectangle(
            new cv.Point2(0, 0),
            new cv.Point2(sectionsMask.sizes[1], sectionsMask.sizes[0]),
            new cv.Vec3(0, 0, 0),
            cv.FILLED
        );
        Object.keys(sections).forEach(sectionName => {
            sections[sectionName].zones.forEach(zone => {
                sectionsMask.drawRectangle(
                    new cv.Point2(zone.x, zone.y),
                    new cv.Point2(zone.x + zone.width, zone.y + zone.height),
                    new cv.Vec(255, 255, 255),
                    cv.FILLED
                );
            });
        });
    }

    // now remove the grayness from areas that are not within the sections mask
    // backgroundMat = backgroundMat.copy(sectionsMask);
    // colorFilteredMat = colorFilteredMat.copy(sectionsMask);

    const foundBall = {
        circle: undefined,
        mat: undefined,
        matchPercentage: 0,
        backgroundMat,
        colorFilteredMat
    };
    const foundCircles = backgroundMat.houghCircles.apply(backgroundMat, args);

    // iterate each circle
    // check if it contains a lot of non-black/dark
    // record it as "foundBall".

    // visual aid

    foundCircles.forEach(circle => {
        // make a mask mat with same size as the old one
        const circleMask = new cv.Mat(backgroundMat.rows, backgroundMat.cols, cv.CV_8U);
        // make sure it's pitch black everywhere
        circleMask.drawRectangle(
            new cv.Point2(0, 0),
            new cv.Point2(backgroundMat.sizes[1], backgroundMat.sizes[0]),
            new cv.Vec3(0, 0, 0),
            cv.FILLED
        );
        // draw a white circle on the mask where the current circle is, with variable offset
        circleMask.drawCircle(
            new cv.Point2(circle.x, circle.y),
            parseInt(circle.z * (1 - options.trimCircleEdgePercentage)),
            new cv.Vec3(255, 255, 255),
            cv.FILLED
        );

        // create a circle background with a near-perfect white, which won't be taken into
        // account when matching amount of ball-perceived grayness
        const singleCircleMatBackground = new cv.Mat(
            backgroundMat.rows,
            backgroundMat.cols,
            cv.CV_8U
        );
        singleCircleMatBackground.drawRectangle(
            new cv.Point2(0, 0),
            new cv.Point2(backgroundMat.sizes[1], backgroundMat.sizes[0]),
            new cv.Vec3(254, 254, 254),
            cv.FILLED
        );

        // get a mat of only the current circle with relevant grayness only
        const singleCircleWithRelevantWhitesMat = colorFilteredMat.copyTo(
            singleCircleMatBackground,
            circleMask
        );

        const matches = singleCircleWithRelevantWhitesMat.inRange(255, 255).countNonZero();
        let nonMatches = null;
        let matchPercentage = null;
        if(options.minPercentage && options.maxPercentage) {
            // get amount of non-matching grayness, but not the blackness outside the circle
            nonMatches = singleCircleWithRelevantWhitesMat.inRange(0, 253).countNonZero();
            // get percent of circle that has matching grayness
            matchPercentage = matches / (matches + nonMatches);
        }

        // is the circle's grayness percentage within the acceptable range?
        if ((!options.minPercentage && !options.maxPercentage) || matchPercentage >= options.minPercentage && matchPercentage <= options.maxPercentage) {
            // get a mat of only the current circle with all colors in grayscale
            const isPaletteCountModeEnabled = options.minPaletteCount || options.maxPaletteCount;
            let paletteCount;
            let singleCircleWithAllColors;
            if (isPaletteCountModeEnabled) {
                singleCircleWithAllColors = backgroundMat.copyTo(
                    singleCircleMatBackground,
                    circleMask
                );
                paletteCount = new Set(singleCircleWithAllColors.getData()).size - 2;
            }

            // is the circle palette that of a metal sphere, or is palette disabled?
            if (
                !isPaletteCountModeEnabled ||
                (paletteCount >= options.minPaletteCount && paletteCount <= options.maxPaletteCount)
            ) {
                // does this circle have more grayness than any previous circle?
                if (matchPercentage > foundBall.matchPercentage) {
                    // save references to this circle's data
                    foundBall.matchPercentage = matchPercentage;
                    // grayestCircle.hitMissMat = hitMissMat;
                    foundBall.roundedMatchPercentage = parseFloat(matchPercentage.toFixed("2"));
                    foundBall.mat = singleCircleWithRelevantWhitesMat;
                    // restore the x to the original image x axis scale before storing the reference
                    foundBall.circle = {
                        x: circle.x,
                        y: circle.y,
                        z: circle.z / (1 - options.trimCircleEdgePercentage)
                    };
                }
            }
        }
    });

    return foundBall;
};
