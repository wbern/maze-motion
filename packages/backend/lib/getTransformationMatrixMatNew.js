const cv = require("opencv4nodejs");
const math = require("mathjs");

module.exports = (imageMat, options, targetResolution, drawVisuals) => {
    const hsvFrame = imageMat.cvtColor(cv.COLOR_BGR2HSV_FULL);
    let maskedCornersMat;

    options = {
        // these get ignored as soon as the db has set them
        // cannyThreshold1: 50,
        // cannyThreshold2: 50,
        // cannyApertureSize: 7,
        // cannyL2gradient: false,

        // houghLinesRho: 1,
        // houghLinesTheta: Math.PI / 180,
        // houghLinesThreshold: 25,
        // houghLinesMinLineLength: 200,
        // houghLinesMaxLineGap: 1000,

        // approxPolyDP: true,
        // closed: false,
        // epsilonPercentage: 0.0005,

        ...options
    };

    // get the colors matching the corner colors
    options.cornerHSVMasks.forEach(hsvMask => {
        const min = new cv.Vec3(hsvMask.min[0], hsvMask.min[1], hsvMask.min[2]);
        const max = new cv.Vec3(hsvMask.max[0], hsvMask.max[1], hsvMask.max[2]);
        const rangeMask = hsvFrame.inRange(min, max);
        maskedCornersMat = imageMat.copyTo(maskedCornersMat || new cv.Mat(), rangeMask);
    });

    const colorFilteredCornersMat = maskedCornersMat;

    // get the contours of the corners
    maskedCornersMat = maskedCornersMat
        .cvtColor(cv.COLOR_BGR2GRAY)
        .threshold(0, 255, cv.THRESH_BINARY);

    if (options.erodePixels && options.erodePixels > 0) {
        maskedCornersMat = maskedCornersMat.erode(
            new cv.Mat(Array(options.erodePixels).fill([255, 255, 255]), cv.CV_8U)
        );
    }
    maskedCornersMat = maskedCornersMat.canny(
        options.cannyThreshold1,
        options.cannyThreshold2,
        options.cannyApertureSize,
        options.cannyL2gradient
    );

    const mode = cv.RETR_CCOMP;
    const findContoursMethod = cv.CHAIN_APPROX_SIMPLE;
    const contours = maskedCornersMat.findContours(mode, findContoursMethod);

    if (contours.length === 0) {
        const e = Error("Could not identify contours of the board");
        e.maskedCornersMat = maskedCornersMat;
        e.colorFilteredCornersMat = colorFilteredCornersMat;
        throw e;
    }

    const contoursBySize = contours.sort((left, right) => right.area - left.area);
    let contour = contoursBySize[0];

    // draw the mat completely black, only draw outer contours
    maskedCornersMat.drawRectangle(
        new cv.Point2(0, 0),
        new cv.Point2(maskedCornersMat.sizes[1], maskedCornersMat.sizes[0]),
        new cv.Vec3(0, 0, 0),
        cv.FILLED
    );

    // approxPolyDP helps us to smoothen the lines
    if (options.approxPolyDP) {
        contour = contoursBySize[0].approxPolyDP(
            options.epsilonPercentage * contoursBySize[0].arcLength(options.closed),
            options.closed
        );
        maskedCornersMat.drawPolylines([contour], options.closed, new cv.Vec3(255, 255, 0), 1);
    } else {
        maskedCornersMat.drawContours([contour], new cv.Vec3(255, 255, 0));
    }

    // find the lines in the drawn contours
    const lines = maskedCornersMat
        .houghLinesP(
            options.houghLinesRho,
            options.houghLinesTheta,
            options.houghLinesThreshold,
            options.houghLinesMinLineLength,
            options.houghLinesMaxLineGap
        )
        .map(line => ({
            y2: line.x,
            y1: line.z,
            x1: line.y,
            x2: line.w
        }));

    if (lines.length < 4) {
        // no lines found or just a few, assume something's wrong.
        const e = Error("Could not identify enough lines of the board, got " + lines.length + ".");
        e.lines = lines;
        e.maskedCornersMat = maskedCornersMat;
        e.colorFilteredCornersMat = colorFilteredCornersMat;
        throw e;
    }

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

    // create geometric center in order to figure out the angles
    // const getCenter = arr =>
    //     arr.reduce((total = 0, currX, index, arr) => {
    //         total += arr[index - 1] ? Math.abs(currX - arr[index - 1]) : 0; // x

    //         // last?
    //         if (index === arr.length - 1) {
    //             return Number(arr[0]) + Number(total / 2);
    //         }

    //         return Number(total);
    //     }, 0);

    // const geoCenterX = getCenter(linePoints.x);
    // const geoCenterY = getCenter(linePoints.y);

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
                    intersect.x >= leftMostX / options.acceptedMarginsForIntersectionsPercentage &&
                    intersect.x <= rightMostX * options.acceptedMarginsForIntersectionsPercentage &&
                    intersect.y >= topMostY / options.acceptedMarginsForIntersectionsPercentage &&
                    intersect.y <= bottomMostY * options.acceptedMarginsForIntersectionsPercentage
                ) {
                    intersections.push(intersect);
                }
            }
        });
        // find ending one
    });

    const brAndtl = intersections
        .map(p => p)
        .sort((left, right) => right.x + right.y - (left.x + left.y));
    const trAndbl = intersections
        .map(p => p)
        .sort((left, right) => right.x - right.y - (left.x - left.y));
    const br = new cv.Point2(brAndtl[0].x, brAndtl[0].y);
    const tl = new cv.Point2(brAndtl[brAndtl.length - 1].x, brAndtl[brAndtl.length - 1].y);
    const tr = new cv.Point2(trAndbl[0].x, trAndbl[0].y);
    const bl = new cv.Point2(trAndbl[trAndbl.length - 1].x, trAndbl[trAndbl.length - 1].y);
    
    if(drawVisuals) {
        intersections.forEach(intersection => {
            colorFilteredCornersMat.drawRectangle(
                new cv.Point2(intersection.x - 5, intersection.y - 5),
                new cv.Point2(intersection.x + 5, intersection.y + 5),
                new cv.Vec3(255, 255, 255),
                -1
            );
        });
    
        lines.forEach(line => {
            colorFilteredCornersMat.drawLine(
                new cv.Point2(line.x1, line.y1),
                new cv.Point2(line.x2, line.y2),
                new cv.Vec3(parseInt(Math.random() * 255),0,parseInt(Math.random() * 255)),
                2
            );
        });
    
        // draw br + tl
        colorFilteredCornersMat.putText("tl", tl, cv.FONT_HERSHEY_SIMPLEX, 0.9, new cv.Vec3(255,255,255), cv.LINE_4);
        colorFilteredCornersMat.drawCircle(tl, 5, new cv.Vec3(255, 0, 100), -1);
        colorFilteredCornersMat.putText("br", br, cv.FONT_HERSHEY_SIMPLEX, 0.9, new cv.Vec3(255,255,255), cv.LINE_4);
        colorFilteredCornersMat.drawCircle(br, 5, new cv.Vec3(255, 0, 100), -1);
        colorFilteredCornersMat.putText("tr", tr, cv.FONT_HERSHEY_SIMPLEX, 0.9, new cv.Vec3(255,255,255), cv.LINE_4);
        colorFilteredCornersMat.drawCircle(tr, 5, new cv.Vec3(255, 0, 100), -1);
        colorFilteredCornersMat.putText("bl", bl, cv.FONT_HERSHEY_SIMPLEX, 0.9, new cv.Vec3(255,255,255), cv.LINE_4);
        colorFilteredCornersMat.drawCircle(bl, 5, new cv.Vec3(255, 0, 100), -1);
    }

    // get angles from geometric center to all the intersecting points
    // const angles = [];
    // intersections.forEach(intersection => {
    //     const angle =
    //         (Math.atan2(intersection.y - geoCenterY, intersection.x - geoCenterX) * 180) / Math.PI +
    //         180;
    //     angles[Math.floor(angle)] = intersection;
    // });

    // // get all the gaps (in degrees) between angles, with value referencing the angle index
    // const gaps = {};
    // Object.keys(angles)
    //     .sort((a, b) => a - b)
    //     .forEach((angle, index, arr) => {
    //         if (index === 0) {
    //             return;
    //         }
    //         gaps[Math.floor(Math.abs(arr[(index + 1) % arr.length] - arr[index]))] = angle;
    //     });

    // //
    // const fourSharpestAngles = Object.keys(gaps)
    //     .slice(-4)
    //     .map(gapKey => Number(gaps[gapKey]));

    // const topRightPoints = angles
    //     .slice(fourSharpestAngles[0] + 1, fourSharpestAngles[1])
    //     .filter(a => a !== undefined);
    // const bottomRightPoints = angles
    //     .slice(fourSharpestAngles[1] + 1, fourSharpestAngles[2])
    //     .filter(a => a !== undefined);
    // const bottomLeftPoints = angles
    //     .slice(fourSharpestAngles[2] + 1, fourSharpestAngles[3])
    //     .filter(a => a !== undefined);
    // const topLeftPoints = angles
    //     .slice(0, fourSharpestAngles[0])
    //     .concat(angles.slice(fourSharpestAngles[3] + 1))
    //     .filter(a => a !== undefined);

    // if (
    //     topRightPoints.length === 0 ||
    //     bottomRightPoints.length === 0 ||
    //     bottomLeftPoints.length === 0 ||
    //     topLeftPoints.length === 0
    // ) {
    //     // failed to identify one of the corners
    //     const e = new Error(
    //         "Failed to identify all 4 corners, only got " +
    //             ((topRightPoints.length > 0) +
    //                 (bottomRightPoints.length > 0) +
    //                 (bottomLeftPoints.length > 0) +
    //                 (topLeftPoints.length > 0))
    //     );
    //     e.maskedCornersMat = maskedCornersMat;
    //     e.lines = lines;
    //     throw e;
    // }

    // const avgPoint = arr =>
    //     arr.reduce((prev, current, index) => {
    //         if (current !== undefined) {
    //             prev.x = (prev.x || 0) + current.x;
    //             prev.y = (prev.y || 0) + current.y;
    //         }

    //         if (index === arr.length - 1) {
    //             prev.x = prev.x / Object.keys(arr).length;
    //             prev.y = prev.y / Object.keys(arr).length;
    //         }

    //         return prev;
    //     });

    // const topRightPoint = avgPoint(topRightPoints);
    // const topLeftPoint = avgPoint(topLeftPoints);
    // const bottomRightPoint = avgPoint(bottomRightPoints);
    // const bottomLeftPoint = avgPoint(bottomLeftPoints);

    const srcPoints = [tl, tr, br, bl];

    const minRes = Math.min(targetResolution.height, targetResolution.width);

    // get the ratio between x and y
    const width = minRes;
    const height = minRes;

    const pad = options.boardPadding * -1;

    // make the destination points, with scaling
    const dstTl = new cv.Point(0 - pad, 0 - pad);
    const dstTr = new cv.Point(width * options.xScale + pad, 0 - pad);
    const dstBr = new cv.Point(width * options.xScale + pad, height * options.yScale + pad);
    const dstbL = new cv.Point(0 - pad, height * options.yScale + pad);

    const dstPoints = [dstTl, dstTr, dstBr, dstbL];

    // do rotations
    for (let i = 0; i < options.rotations; i++) {
        dstPoints.unshift(dstPoints.pop());
    }

    const transformationMatrixMat = cv.getPerspectiveTransform(srcPoints, dstPoints);
    return {
        transformationMatrixMat,
        maskedCornersMat,
        colorFilteredCornersMat,
        foundCorners: lines.length,
        corners: srcPoints,
        lines
    };
};
