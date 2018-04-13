const cv = require("opencv4nodejs");

module.exports = (boardImage, options) => {
    // now try to normalize the flat image to have as many circular holes as possible
    const args = [
        // method: Define the detection method. Currently this is the only one available in OpenCV
        cv.HOUGH_GRADIENT,
        // dp: The inverse ratio of resolution
        1,
        // minDist: Minimum distance between detected centers
        // retrievedMats["2D Image"].rows / 8,
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
    const circlesMat = boardImage
        // houghCircles requires grayscale
        .cvtColor(cv.COLOR_BGR2GRAY)
        // remove all existing pure-white colorings in the image
        .threshold(254, 255, cv.THRESH_TRUNC);

    // create mat with relevant grays as white
    let relevantGraynessMask = boardImage
        .cvtColor(cv.COLOR_BGR2HSV_FULL)
        .gaussianBlur(
            new cv.Size(options.blurAmount, options.blurAmount),
            options.blurKernel,
            options.blurKernel
        );
    relevantGraynessMask = relevantGraynessMask.inRange(
        options.ballHSVMask.min,
        options.ballHSVMask.max
    );

    const grayestCircle = { circle: undefined, mat: undefined, matchPercentage: 0 };
    const foundCircles = circlesMat.houghCircles.apply(circlesMat, args);

    // iterate each circle
    // check if it contains a lot of non-black/dark
    // record it as "grayestCircle".

    // visual aid
    foundCircles.forEach(circle => {
        // make a mask mat with same size as the old one
        const circleMask = new cv.Mat(circlesMat.rows, circlesMat.cols, cv.CV_8U);
        // make sure it's pitch black everywhere
        circleMask.drawRectangle(
            new cv.Point2(0, 0),
            new cv.Point2(circlesMat.sizes[1], circlesMat.sizes[0]),
            new cv.Vec3(0, 0, 0),
            -1
        );
        // draw a white circle on the mask where the current circle is, with variable offset
        circleMask.drawCircle(
            new cv.Point2(circle.x, circle.y),
            parseInt(circle.z * (1 - options.trimCircleEdgePercentage)),
            new cv.Vec3(255, 255, 255),
            -1000
        );

        // create a circle background with a near-perfect white, which won't be taken into
        // account when matching amount of ball-perceived grayness
        const singleCircleMatBackground = new cv.Mat(circlesMat.rows, circlesMat.cols, cv.CV_8U);
        singleCircleMatBackground.drawRectangle(
            new cv.Point2(0, 0),
            new cv.Point2(circlesMat.sizes[1], circlesMat.sizes[0]),
            new cv.Vec3(254, 254, 254),
            -1
        );

        // get a mat of only the current circle with relevant grayness only
        const singleCircleWithRelevantWhitesMat = relevantGraynessMask.copyTo(
            singleCircleMatBackground,
            circleMask
        );

        const matches = singleCircleWithRelevantWhitesMat.inRange(255, 255).countNonZero();
        // get amount of non-matching grayness, but not the blackness outside the circle
        const nonMatches = singleCircleWithRelevantWhitesMat.inRange(0, 253).countNonZero();
        // get percent of circle that has matching grayness
        const matchPercentage = matches / (matches + nonMatches);

        // is the circle's grayness percentage within the acceptable range?
        if (matchPercentage >= options.minPercentage && matchPercentage <= options.maxPercentage) {
            // get a mat of only the current circle with all colors in grayscale
            const singleCircleWithAllColors = circlesMat.copyTo(
                singleCircleMatBackground,
                circleMask
            );
            const paletteCount = new Set(singleCircleWithAllColors.getData()).size - 2;

            // is the circle palette that of a metal sphere?
            if (
                paletteCount >= options.minPaletteCount &&
                paletteCount <= options.maxPaletteCount
            ) {
                // does this circle have more grayness than any previous circle?
                if (matchPercentage > grayestCircle.matchPercentage) {
                    // save references to this circle's data
                    grayestCircle.matchPercentage = matchPercentage;
                    // grayestCircle.hitMissMat = hitMissMat;
                    grayestCircle.roundedMatchPercentage = Math.round(matchPercentage * 100) / 100;
                    grayestCircle.mat = singleCircleWithRelevantWhitesMat;
                    // restore the x to the original image x axis scale before storing the reference
                    grayestCircle.circle = {
                        x: circle.x,
                        y: circle.y,
                        z: circle.z / (1 - options.trimCircleEdgePercentage)
                    };
                }
            }
        }
    });

    // visual aid
    // const visualAid = scaledCirclesMat.cvtColor(cv.COLOR_GRAY2BGR);
    // const drawCircle = (c) => {
    //     visualAid.drawCircle(
    //         new cv.Point2(c.x, c.y),
    //         c.z * 1,
    //         new cv.Vec3(255, 255, 0),
    //         1
    //     );
    //     visualAid.drawCircle(
    //         new cv.Point2(c.x, c.y),
    //         1,
    //         new cv.Vec3(255, 255, 0),
    //         2
    //     );
    // };
    // drawCircle(grayestCircle.circle);

    // visualAid.drawCircle(
    //     new cv.Point2(grayestCircle.circle.x, grayestCircle.circle.y),
    //     grayestCircle.circle.z * 1,
    //     new cv.Vec3(255, 255, 0),
    //     1
    // );
    // visualAid.drawCircle(
    //     new cv.Point2(grayestCircle.circle.x, grayestCircle.circle.y),
    //     1,
    //     new cv.Vec3(255, 255, 0),
    //     2
    // );

    // cv.imshowWait("visualAid", visualAid);

    return grayestCircle;
};
