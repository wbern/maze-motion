const cv = require("opencv4nodejs");
const math = require("mathjs");

module.exports = (imageMat, options, targetResolution) => {
    const hsvFrame = imageMat.cvtColor(cv.COLOR_BGR2HSV_FULL);
    let maskedCornersMat;

    // get the colors matching the corner colors
    options.cornerHSVMasks.forEach(hsvMask => {
        const min = new cv.Vec3(hsvMask.min[0], hsvMask.min[1], hsvMask.min[2]);
        const max = new cv.Vec3(hsvMask.max[0], hsvMask.max[1], hsvMask.max[2]);
        const rangeMask = hsvFrame.inRange(min, max);
        maskedCornersMat = imageMat.copyTo(maskedCornersMat || new cv.Mat(), rangeMask);
    });

    // get the contours of the corners
    maskedCornersMat = maskedCornersMat.cvtColor(cv.COLOR_BGR2GRAY);

    // // maskedCornersMat = maskedCornersMat.gaussianBlur(
    // //     new cv.Size(1, 1),
    // //     5,
    // //     5
    // // );
    maskedCornersMat = maskedCornersMat.threshold(0, 255, cv.THRESH_BINARY);
    if (options.erodePixels && options.erodePixels > 0) {
        maskedCornersMat = maskedCornersMat.erode(
            new cv.Mat(Array(options.erodePixels).fill([255, 255, 255]), cv.CV_8U)
        );
    }
    maskedCornersMat = maskedCornersMat.erode(new cv.Mat(Array(6).fill([255, 255, 255]), cv.CV_8U));
    const threshold1 = 50;
    const threshold2 = 50;
    const apertureSize = 7;
    const L2gradient = false;
    maskedCornersMat = maskedCornersMat.canny(threshold1, threshold2, apertureSize, L2gradient);
    // get lines of the matching edges mask
    const rho = 1;
    const theta = Math.PI / 180;
    const threshold = 25;
    const minLineLength = 80;
    const maxLineGap = 150;

    const lines = maskedCornersMat
        .houghLinesP(rho, theta, threshold, minLineLength, maxLineGap)
        .map(line => ({
            y2: line.x,
            y1: line.z,
            x1: line.y,
            x2: line.w
        }));

    // map all the lines on separate x and y axis
    const linePoints = lines.reduce(
        (collection, curr) => {
            collection.x.push(curr.x1);
            collection.x.push(curr.x2);

            collection.y.push(curr.y1);
            collection.y.push(curr.y2);
            return collection;
        },
        { x: [], y: [] }
    );

    // sort the points on each axis
    linePoints.x = linePoints.x.sort((a, b) => a - b);
    linePoints.y = linePoints.y.sort((a, b) => a - b);

    // get the extremes to later filter out far-away intersections
    const leftMostX = linePoints.x[0];
    const rightMostX = linePoints.x[linePoints.x.length - 1];
    const topMostY = linePoints.y[0];
    const bottomMostY = linePoints.y[linePoints.y.length - 1];

    // 110% size of sides is acceptable for intersections
    const acceptedMarginsForIntersectionsPercentage = 1.1;

    // create geometric center in order to figure out the angles
    const getCenter = arr =>
        arr.reduce((total = 0, currX, index, arr) => {
            total += arr[index - 1] ? Math.abs(currX - arr[index - 1]) : 0; // x

            // last?
            if (index === arr.length - 1) {
                return Number(arr[0]) + Number(total / 2);
            }

            return Number(total);
        }, 0);

    const geoCenterX = getCenter(linePoints.x);
    const geoCenterY = getCenter(linePoints.y);

    // get the intersections of all the lines
    const intersections = [];
    lines.forEach((line, i) => {
        if (!line) {
            return;
        }

        lines.forEach((otherLine, j) => {
            if (i === j) {
                // same line
                return;
            }

            // returns eg. [5, 5], or null
            let intersect = math.intersect(
                [line.x1, line.y1],
                [line.x2, line.y2],
                [otherLine.x1, otherLine.y1],
                [otherLine.x2, otherLine.y2]
            );

            if (intersect !== null) {
                intersect = {
                    x: Number(intersect[0]),
                    y: Number(intersect[1])
                };

                // is the intersection reasonably within the area of the board?
                if (
                    intersect.x >= leftMostX / acceptedMarginsForIntersectionsPercentage &&
                    intersect.x <= rightMostX * acceptedMarginsForIntersectionsPercentage &&
                    intersect.y >= topMostY / acceptedMarginsForIntersectionsPercentage &&
                    intersect.y <= bottomMostY * acceptedMarginsForIntersectionsPercentage
                ) {
                    intersections.push(intersect);
                }
            }
        });
        // find ending one
    });

    // get angles from geometric center to all the intersecting points
    const angles = [];
    intersections.forEach(intersection => {
        const angle =
            Math.atan2(intersection.y - geoCenterY, intersection.x - geoCenterX) * 180 / Math.PI +
            180;
        angles[Math.floor(angle)] = intersection;
    });

    // get all the gaps (in degrees) between angles, with value referencing the angle index
    const gaps = {};
    Object.keys(angles)
        .sort((a, b) => a - b)
        .forEach((angle, index, arr) => {
            if (index === 0) {
                return;
            }
            gaps[Math.floor(Math.abs(arr[(index + 1) % arr.length] - arr[index]))] = angle;
        });

    //
    const fourSharpestAngles = Object.keys(gaps)
        .slice(-4)
        .map(gapKey => Number(gaps[gapKey]));

    const topRightPoints = angles
        .slice(fourSharpestAngles[0] + 1, fourSharpestAngles[1])
        .filter(a => a !== undefined);
    const bottomRightPoints = angles
        .slice(fourSharpestAngles[1] + 1, fourSharpestAngles[2])
        .filter(a => a !== undefined);
    const bottomLeftPoints = angles
        .slice(fourSharpestAngles[2] + 1, fourSharpestAngles[3])
        .filter(a => a !== undefined);
    const topLeftPoints = angles
        .slice(0, fourSharpestAngles[0])
        .concat(angles.slice(fourSharpestAngles[3] + 1))
        .filter(a => a !== undefined);

    const avgPoint = arr =>
        arr.reduce((prev, current, index) => {
            if (current !== undefined) {
                prev.x = (prev.x || 0) + current.x;
                prev.y = (prev.y || 0) + current.y;
            }

            if (index === arr.length - 1) {
                prev.x = prev.x / Object.keys(arr).length;
                prev.y = prev.y / Object.keys(arr).length;
            }

            return prev;
        });

    const topRightPoint = avgPoint(topRightPoints);
    const topLeftPoint = avgPoint(topLeftPoints);
    const bottomRightPoint = avgPoint(bottomRightPoints);
    const bottomLeftPoint = avgPoint(bottomLeftPoints);

    const srcPoints = [topLeftPoint, topRightPoint, bottomRightPoint, bottomLeftPoint];

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

    // do rotations
    for (let i = 0; i < options.rotations; i++) {
        dstPoints.unshift(dstPoints.pop());
    }

    const transformationMatrixMat = cv.getPerspectiveTransform(srcPoints, dstPoints);
    return {
        transformationMatrixMat,
        maskedCornersMat,
        foundCorners: lines.length,
        corners: srcPoints,
        lines,
        center: { x: geoCenterX, y: geoCenterY }
    };
};