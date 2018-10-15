const cv = require("opencv4nodejs");
const math = require("mathjs");

const getCorners = (contours, cornerPadding) => {
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
    if (options.erodePixels && options.erodePixels > 0) {
        maskedCornersMat = maskedCornersMat.erode(
            new cv.Mat(Array(options.erodePixels).fill([255, 255, 255]), cv.CV_8U)
        );
    }

    // // maskedCornersMat = maskedCornersMat.gaussianBlur(
    // //     new cv.Size(1, 1),
    // //     5,
    // //     5
    // // );
    maskedCornersMat = maskedCornersMat.threshold(0, 255, cv.THRESH_BINARY);
    maskedCornersMat = maskedCornersMat.erode(new cv.Mat(Array(6).fill([255, 255, 255]), cv.CV_8U));
    maskedCornersMat = maskedCornersMat.canny(50, 50, 7, true);
    const lines = maskedCornersMat.houghLinesP(1, Math.PI / 180, 25, 0, 50).map(line => ({
        y2: line.x,
        y1: line.z,
        x1: line.y,
        x2: line.w
    }));

    maskedCornersMat.drawRectangle(
        new cv.Point2(0, 0),
        new cv.Point2(maskedCornersMat.sizes[1], maskedCornersMat.sizes[0]),
        new cv.Vec3(0, 0, 0),
        cv.FILLED
    );

    const linePoints = lines.reduce(
        (coll, curr) => {
            coll.x.push(curr.x1);
            coll.x.push(curr.x2);

            coll.y.push(curr.y1);
            coll.y.push(curr.y2);
            return coll;
        },
        { x: [], y: [] }
    );

    linePoints.x = linePoints.x.sort((a, b) => a - b);
    linePoints.y = linePoints.y.sort((a, b) => a - b);

    const leftMostX = linePoints.x[0];
    const rightMostX = linePoints.x.slice(-1);
    const topMostY = linePoints.y[0];
    const bottomMostY = linePoints.y.slice(-1);

    const centerX = linePoints.x.reduce((total = 0, currX, index, arr) => {
        total += arr[index - 1] ? Math.abs(currX - arr[index - 1]) : 0; // x

        // last?
        if (index === arr.length - 1) {
            return Number(arr[0]) + Number(total / 2);
        }

        return Number(total);
    }, 0);

    const centerY = linePoints.y.reduce((total = 0, currX, index, arr) => {
        total += arr[index - 1] ? Math.abs(currX - arr[index - 1]) : 0; // x

        // last?
        if (index === arr.length - 1) {
            return Number(arr[0]) + Number(total / 2);
        }

        return Number(total);
    }, 0);

    // const intersectionsByLength = [];
    const intersections = [];
    const intersectionsByX = [];
    const intersectionsByY = [];

    lines.forEach((line, i) => {
        maskedCornersMat.drawLine(
            new cv.Point2(line.x1, line.y1),
            new cv.Point2(line.x2, line.y2),
            new cv.Vec3(255, 255, 255),
            1
        );

        if (!line) {
            return;
        }

        lines.forEach((otherLine, j) => {
            if (i === j) {
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

                if (
                    intersect.x >= leftMostX &&
                    intersect.x <= rightMostX &&
                    intersect.y >= topMostY &&
                    intersect.y <= bottomMostY
                ) {
                    // const length = Math.hypot(x1 - x2, y1 - y2);
                    // intersectionsByLength[length] = intersectionsByLength[length] || [];
                    // intersectionsByLength[length].push(intersect);
                    intersections.push(intersect);

                    intersectionsByX[intersect.x] = intersectionsByX[intersect.x] || [];
                    intersectionsByX[intersect.x].push(intersect);

                    intersectionsByY[intersect.y] = intersectionsByY[intersect.y] || [];
                    intersectionsByY[intersect.y].push(intersect);
                    // intersectionsByY[intersect.y].push(intersect);
                }
            }
        });
        // find ending one
    });

    // get angles from geometric center to all the intersecting points
    const angles = [];
    intersections.forEach(intersection => {
        const angle =
            Math.atan2(intersection.y - centerY, intersection.x - centerX) * 180 / Math.PI + 180;
        angles[Math.floor(angle)] = intersection;
    });

    const gaps = {};

    Object.keys(angles)
        .sort((a, b) => a - b)
        .forEach((angle, index, arr) => {
            if (index === 0) {
                return;
            }
            gaps[Math.floor(Math.abs(arr[(index + 1) % arr.length] - arr[index]))] = angle;
        });

    const fourAngles = Object.keys(gaps)
        .slice(-4)
        .map(gapKey => Number(gaps[gapKey]));

    const topRightPointz = angles.slice(fourAngles[0] + 1, fourAngles[1]);
    const bottomRightPointz = angles.slice(fourAngles[1] + 1, fourAngles[2]);
    const bottomLeftPointz = angles.slice(fourAngles[2] + 1, fourAngles[3]);
    const topLeftPointz = angles.slice(0, fourAngles[0]).concat(angles.slice(fourAngles[3] + 1));
    // TODO: Get 4 biggest angle gaps

    const getAveragePoint = arr =>
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

    const topRightPoint = getAveragePoint(topRightPointz);
    const topLeftPoint = getAveragePoint(topLeftPointz);
    const bottomRightPoint = getAveragePoint(bottomRightPointz);
    const bottomLeftPoint = getAveragePoint(bottomLeftPointz);

    // intersections.forEach(intersection => {
    //     maskedCornersMat.drawCircle(
    //         new cv.Point2(intersection.x, intersection.y),
    //         10,
    //         new cv.Vec3(255, 255, 255),
    //         2
    //     );
    // });

    maskedCornersMat.drawCircle(
        new cv.Point2(averagedTopRightPoint.x, averagedTopRightPoint.y),
        5,
        new cv.Vec3(255, 255, 255),
        15
    );

    maskedCornersMat.drawCircle(
        new cv.Point2(centerX, centerY),
        15,
        new cv.Vec3(255, 255, 255),
        -1
    );
    cv.imshowWait("center", maskedCornersMat);

    cv.imshowWait("canny", maskedCornersMat);
    maskedCornersMat = maskedCornersMat.dilate(
        new cv.Mat(Array(15).fill([255, 255, 255]), cv.CV_8U)
    );
    cv.imshowWait("dilate", maskedCornersMat);
    // cv.imshowWait("canny", k);
    // // maskedCornersMat.erode()
    const mode = cv.RETR_EXTERNAL;
    // // const mode = cv.RETR_CCOMP;
    const findContoursMethod = cv.CHAIN_APPROX_SIMPLE;
    // // const findContoursMethod = cv.CHAIN_APPROX_SIMPLE;
    const foundContours = maskedCornersMat.findContours(mode, findContoursMethod);

    const mat = new cv.Mat(maskedCornersMat.rows, maskedCornersMat.cols, cv.CV_8U);
    mat.drawRectangle(
        new cv.Point2(0, 0),
        new cv.Point2(mat.sizes[1], mat.sizes[0]),
        new cv.Vec3(0, 0, 0),
        cv.FILLED
    );
    // mat.drawContours(foundContours, new cv.Vec3(255, 255, 255), { thickness: 10 });
    // cv.imshowWait("colors", maskedCornersMat);

    const largestContour = foundContours.reduce((prev, current) => {
        return prev.area > current.area ? prev : current;
    });
    // mat.drawContours([largestContour], new cv.Vec3(255, 255, 255), { thickness: 10 });
    // cv.imshowWait("contours", mat);

    const getContourDimensions = (c, rectangleDilation = 0) => {
        const d = c.boundingRect();
        return {
            topLeft: new cv.Point2(d.x - rectangleDilation, d.y - rectangleDilation),
            topRight: new cv.Point2(d.x + d.width + rectangleDilation, d.y - rectangleDilation),
            bottomLeft: new cv.Point2(d.x - rectangleDilation, d.y + d.height + rectangleDilation),
            bottomRight: new cv.Point2(
                d.x + d.width + rectangleDilation,
                d.y + d.height + rectangleDilation
            )
        };
    };

    // draw rectangles around each contour to absorb smaller neighbouring contours in broken scans
    // foundContours.forEach(c => {
    //     const points = getContourDimensions(c, options.cornerDilation);
    //     maskedCornersMat.drawRectangle(
    //         points.topLeft,
    //         points.bottomRight,
    //         new cv.Vec(255, 255, 255),
    //         cv.FILLED
    //     );
    // });
    // afterwards, renew the contours found for more clarity
    // foundContours = maskedCornersMat.findContours(mode, findContoursMethod);

    const d = getContourDimensions(largestContour);

    if (largestContour || foundContours.length === 4) {
        // we have the right amount of contours for each corner, continue
        // const srcPoints = getCorners(foundContours, options.cornerPadding);

        const minRes = Math.min(targetResolution.height, targetResolution.width);

        // get the ratio between x and y
        const width = minRes;
        const height = minRes;

        const pad = options.boardPadding * -1;

        // make the destination points, with scaling
        const topLeft = new cv.Point(0 - pad, 0 - pad);
        const topRight = new cv.Point(width * options.xScale + pad, 0 - pad);
        const bottomRight = new cv.Point(
            width * options.xScale + pad,
            height * options.yScale + pad
        );
        const bottomLeft = new cv.Point(0 - pad, height * options.yScale + pad);

        const dstPoints = [topLeft, topRight, bottomRight, bottomLeft];

        // do rotations
        for (let i = 0; i < options.rotations; i++) {
            dstPoints.unshift(dstPoints.pop());
        }

        const transformationMatrixMat = cv.getPerspectiveTransform(
            [
                // top-left
                d.topLeft,
                // top-right
                d.topRight,
                // bottom-right
                d.bottomRight,
                // bottom-left
                d.bottomLeft
            ],
            dstPoints
        );
        return {
            transformationMatrixMat,
            maskedCornersMat,
            foundCorners: foundContours.length,
            foundContours
        };
    } else {
        return {
            transformationMatrixMat: null,
            maskedCornersMat,
            foundCorners: foundContours.length,
            foundContours
        };
    }
};
