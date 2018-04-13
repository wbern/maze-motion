const cv = require("opencv4nodejs");

const getCorners = (contours, cornerOffset) => {
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
            centeredValue(topLeft.x, topLeft.width) - cornerOffset,
            centeredValue(topLeft.y, topLeft.height) - cornerOffset
        ),
        // top-right
        new cv.Point(
            centeredValue(topRight.x, topRight.width) + cornerOffset,
            centeredValue(topRight.y, topRight.height) - cornerOffset
        ),
        // bottom-right
        new cv.Point(
            centeredValue(bottomRight.x, bottomRight.width) + cornerOffset,
            centeredValue(bottomRight.y, bottomRight.height) + cornerOffset
        ),
        // bottom-left
        new cv.Point(
            centeredValue(bottomLeft.x, bottomLeft.width) - cornerOffset,
            centeredValue(bottomLeft.y, bottomLeft.height) + cornerOffset
        )
    ];
};

module.exports = (
    imageMat,
    cornerHSVMasks,
    targetResolution,
    cornerOffset = 5,
    erodePixels = 0,
    rotations = 3
) => {
    const hsvFrame = imageMat.cvtColor(cv.COLOR_BGR2HSV_FULL);
    let maskedCornersMat;

    // get the colors matching the corner colors
    cornerHSVMasks.forEach(hsvMask => {
        const min = new cv.Vec3(hsvMask.min[0], hsvMask.min[1], hsvMask.min[2]);
        const max = new cv.Vec3(hsvMask.max[0], hsvMask.max[1], hsvMask.max[2]);
        const rangeMask = hsvFrame.inRange(min, max);
        maskedCornersMat = imageMat.copyTo(maskedCornersMat || new cv.Mat(), rangeMask);
    });

    // get the contours of the corners
    maskedCornersMat = maskedCornersMat.cvtColor(cv.COLOR_BGR2GRAY);
    if (erodePixels && erodePixels > 0) {
        maskedCornersMat = maskedCornersMat.erode(
            new cv.Mat(Array(erodePixels).fill([255, 255, 255]), cv.CV_8U)
        );
    }

    const mode = cv.RETR_EXTERNAL;
    const findContoursMethod = cv.CHAIN_APPROX_NONE;
    let contours = maskedCornersMat.findContours(mode, findContoursMethod);

    const getContourDimensions = (c, outlineMargin = 0) => {
        const d = c.boundingRect();
        return {
            topLeft: new cv.Point2(d.x - outlineMargin, d.y - outlineMargin),
            bottomRight: new cv.Point2(
                d.x + d.width + outlineMargin,
                d.y + d.height + outlineMargin
            )
        };
    };

    // draw rectangles around each contour to absorb smaller neighbouring contours in broken scans
    contours.forEach(c => {
        const points = getContourDimensions(c, 2);
        maskedCornersMat.drawRectangle(
            points.topLeft,
            points.bottomRight,
            new cv.Vec(255, 255, 255),
            cv.FILLED
        );
    });
    // afterwards, renew the contours found for more clarity
    contours = maskedCornersMat.findContours(mode, findContoursMethod);

    if (contours.length === 4) {
        // we have the right amount of contours for each corner, continue
        const srcPoints = getCorners(contours, cornerOffset);

        const minRes = Math.min(targetResolution.height, targetResolution.width);

        // get the ratio between x and y
        const width = minRes;
        const height = minRes;

        // make the destination points, with scaling
        const topLeft = new cv.Point(0, 0);
        const topRight = new cv.Point(width, 0);
        const bottomRight = new cv.Point(width, height);
        const bottomLeft = new cv.Point(0, height);

        const dstPoints = [topLeft, topRight, bottomRight, bottomLeft];

        // do rotations
        for (let i = 0; i < rotations; i++) {
            dstPoints.unshift(dstPoints.pop());
        }

        const transformationMatrixMat = cv.getPerspectiveTransform(srcPoints, dstPoints);
        return { transformationMatrixMat, maskedCornersMat };
    } else {
        throw new Error("Found " + contours.length + " corners, expected 4");
    }
};
