const cv = require("opencv4nodejs");

const identifyCorners = (contours, cornerPadding) => {
    const bounds = contours.map(c => c.boundingRect());

    const centeredValue = (axisValue, sizeValue) => axisValue + sizeValue / 2;

    const highestTwoXBounds = bounds
        .sort((a, b) => centeredValue(a.x, a.width) - centeredValue(b.x, b.width))
        .slice(-2);
    const lowestTwoXBounds = bounds
        .sort((a, b) => centeredValue(b.x, b.width) - centeredValue(a.x, a.width))
        .slice(-2);

    // of the two right-most bounds, which one is upper and lower?
    const topRight =
        highestTwoXBounds[0].y < highestTwoXBounds[1].y
            ? highestTwoXBounds[0]
            : highestTwoXBounds[1];
    const bottomRight =
        highestTwoXBounds[0].y > highestTwoXBounds[1].y
            ? highestTwoXBounds[0]
            : highestTwoXBounds[1];
    // of the two left-most bounds, which one is upper and lower?
    const topLeft =
        lowestTwoXBounds[0].y < lowestTwoXBounds[1].y ? lowestTwoXBounds[0] : lowestTwoXBounds[1];
    const bottomLeft =
        lowestTwoXBounds[0].y > lowestTwoXBounds[1].y ? lowestTwoXBounds[0] : lowestTwoXBounds[1];

    return [
        // top-left
        new cv.Point(
            centeredValue(topLeft.x, topLeft.width) - cornerPadding,
            centeredValue(topLeft.y, topLeft.height) - cornerPadding
        ),
        // top-right
        new cv.Point(
            centeredValue(topRight.x, topRight.width) + cornerPadding,
            centeredValue(topRight.y, topRight.height) - cornerPadding
        ),
        // bottom-right
        new cv.Point(
            centeredValue(bottomRight.x, bottomRight.width) + cornerPadding,
            centeredValue(bottomRight.y, bottomRight.height) + cornerPadding
        ),
        // bottom-left
        new cv.Point(
            centeredValue(bottomLeft.x, bottomLeft.width) - cornerPadding,
            centeredValue(bottomLeft.y, bottomLeft.height) + cornerPadding
        )
    ];
};

module.exports = (imageMat, options, targetResolution, drawVisuals) => {
    const hsvFrame = imageMat.cvtColor(cv.COLOR_BGR2HSV_FULL);
    let maskedCornersMat;

    // get the colors matching the corner colors
    options.cornerHSVMasks.forEach(hsvMask => {
        const min = new cv.Vec3(hsvMask.min[0], hsvMask.min[1], hsvMask.min[2]);
        const max = new cv.Vec3(hsvMask.max[0], hsvMask.max[1], hsvMask.max[2]);
        const rangeMask = hsvFrame.inRange(min, max);
        maskedCornersMat = imageMat.copyTo(maskedCornersMat || new cv.Mat(), rangeMask);
    });

    if (options.erodePixels && options.erodePixels > 0) {
        maskedCornersMat = maskedCornersMat.erode(
            new cv.Mat(Array(options.erodePixels).fill([255, 255, 255]), cv.CV_8U)
        );
    }

    const colorFilteredCornersMat = maskedCornersMat;

    // get the contours of the corners
    maskedCornersMat = maskedCornersMat
        .cvtColor(cv.COLOR_BGR2GRAY)
        .threshold(0, 255, cv.THRESH_BINARY);

    maskedCornersMat = maskedCornersMat.canny(
        options.cannyThreshold1,
        options.cannyThreshold2,
        options.cannyApertureSize,
        options.cannyL2gradient
    );

    const mode = cv.RETR_EXTERNAL;
    const findContoursMethod = cv.CHAIN_APPROX_NONE;
    let foundContours = maskedCornersMat.findContours(mode, findContoursMethod);

    const getContourDimensions = (c, rectangleDilation = 0) => {
        const d = c.boundingRect();
        return {
            topLeft: new cv.Point2(d.x - rectangleDilation, d.y - rectangleDilation),
            bottomRight: new cv.Point2(
                d.x + d.width + rectangleDilation,
                d.y + d.height + rectangleDilation
            )
        };
    };

    // draw rectangles around each contour to absorb smaller neighbouring contours in broken scans
    if (options.cornerDilation && options.cornerDilation > 0) {
        foundContours.forEach(c => {
            const p = getContourDimensions(c);
            maskedCornersMat.drawCircle(
                new cv.Point2(
                    (p.topLeft.x + p.bottomRight.x) / 2,
                    (p.topLeft.y + p.bottomRight.y) / 2
                ),
                1 + options.cornerDilation,
                new cv.Vec(255, 255, 255),
                cv.FILLED
            );
        });
        // afterwards, renew the contours found for more clarity
        foundContours = maskedCornersMat.findContours(mode, findContoursMethod);
    }

    if (foundContours.length < 4) {
        const e = new Error("Could not identify 4 corners, got " + foundContours.length + ".");
        e.maskedCornersMat = maskedCornersMat;
        e.colorFilteredCornersMat = colorFilteredCornersMat;

        e.foundCorners = foundContours.length;
        e.foundContours = foundContours;
        throw e;
    }

    foundContours = foundContours.sort((left, right) => right.area - left.area).slice(0, 4);

    // we have the right amount of contours for each corner, continue
    const [tl, tr, br, bl] = identifyCorners(foundContours, options.cornerPadding);
    const srcPoints = [tl, tr, br, bl];

    const minRes = Math.min(targetResolution.height, targetResolution.width);

    // get the ratio between x and y
    const width = minRes;
    const height = minRes;

    const pad = options.boardPadding * -1;

    // make the destination points, with scaling
    const topLeft = new cv.Point(0 - pad, 0 - pad);
    const topRight = new cv.Point(width * options.xScale + pad, 0 - pad);
    const bottomRight = new cv.Point(width * options.xScale + pad, height * options.yScale + pad);
    const bottomLeft = new cv.Point(0 - pad, height * options.yScale + pad);

    const dstPoints = [topLeft, topRight, bottomRight, bottomLeft];

    if (drawVisuals) {
        // draw br + tl
        colorFilteredCornersMat.putText(
            "tl",
            tl,
            cv.FONT_HERSHEY_SIMPLEX,
            0.9,
            new cv.Vec3(255, 255, 255),
            cv.LINE_4
        );
        colorFilteredCornersMat.drawCircle(tl, 5, new cv.Vec3(255, 0, 100), -1);
        colorFilteredCornersMat.putText(
            "br",
            br,
            cv.FONT_HERSHEY_SIMPLEX,
            0.9,
            new cv.Vec3(255, 255, 255),
            cv.LINE_4
        );
        colorFilteredCornersMat.drawCircle(br, 5, new cv.Vec3(255, 0, 100), -1);
        colorFilteredCornersMat.putText(
            "tr",
            tr,
            cv.FONT_HERSHEY_SIMPLEX,
            0.9,
            new cv.Vec3(255, 255, 255),
            cv.LINE_4
        );
        colorFilteredCornersMat.drawCircle(tr, 5, new cv.Vec3(255, 0, 100), -1);
        colorFilteredCornersMat.putText(
            "bl",
            bl,
            cv.FONT_HERSHEY_SIMPLEX,
            0.9,
            new cv.Vec3(255, 255, 255),
            cv.LINE_4
        );
        colorFilteredCornersMat.drawCircle(bl, 5, new cv.Vec3(255, 0, 100), -1);
    }

    // do rotations
    for (let i = 0; i < options.rotations; i++) {
        dstPoints.unshift(dstPoints.pop());
    }

    const transformationMatrixMat = cv.getPerspectiveTransform(srcPoints, dstPoints);
    return {
        transformationMatrixMat,
        maskedCornersMat,
        colorFilteredCornersMat,
        foundCorners: foundContours.length,
        foundContours
    };
};
