const cv = require("opencv4nodejs");

const params = new cv.SimpleBlobDetectorParams();
params.blobColor = 255;
params.filterByArea = true;
params.filterByCircularity = false;
params.filterByColor = false;
params.filterByConvexity = false;
params.filterByInertia = false;
// params.maxArea = 0;
// params.maxCircularity = 0;
// params.maxConvexity = 0;
// params.maxInertiaRatio = 0;
// params.maxThreshold = 0;
params.minArea = 50;
// params.minCircularity = 0;
// params.minConvexity = 0;
// params.minDistBetweenBlobs = 0;
// params.minInertiaRatio = 0;
// params.minRepeatability = 0;
// params.minThreshold = 0;
// params.thresholdStep = 0;

const blobDetector = new cv.SimpleBlobDetector(params);

module.exports = (boardImage, sections, options) => {
    // now try to normalize the flat image to have as many circular holes as possible
    // const args = [
    //     // method: Define the detection method. Currently this is the only one available in OpenCV
    //     cv.HOUGH_GRADIENT,
    //     // dp: The inverse ratio of resolution
    //     1,
    //     // minDist: Minimum distance between detected centers
    //     options.houghCircleSettings.minDist,
    //     // param1: Upper threshold for the internal Canny edge detector
    //     options.houghCircleSettings.cannyUpperThreshold,
    //     // param2: Threshold for center detection.
    //     options.houghCircleSettings.centerDetectionThreshold,
    //     // minRadius: Minimum radius to be detected. If unknown, put zero as default.
    //     options.houghCircleSettings.minRadius,
    //     // maxRadius: Maximum radius to be detected. If unknown, put zero as default
    //     options.houghCircleSettings.maxRadius
    // ];

    // mark a range of grays as completely white, onto the forCirclesMat
    // const backgroundMat = boardImage
    //     // houghCircles requires grayscale
    //     .cvtColor(cv.COLOR_BGR2GRAY)
    //     // remove all existing pure-white colorings in the image
    //     .threshold(254, 255, cv.THRESH_TRUNC)
    //     .gaussianBlur(
    //         new cv.Size(options.blurAmount, options.blurAmount),
    //         options.blurKernel,
    //         options.blurKernel
    //     );

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

    const threshold1 = 0;
    const threshold2 = 0;
    const apertureSize = 3;
    const L2gradient = false;
    const cannyMat = colorFilteredMat.canny(threshold1, threshold2, apertureSize, L2gradient);

    const mode = cv.RETR_CCOMP;
    const findContoursMethod = cv.CHAIN_APPROX_NONE;
    const foundContours = cannyMat.findContours(mode, findContoursMethod);
    cannyMat.drawContours(foundContours, new cv.Vec3(255, 255, 255));

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

    const circles = foundContours.map(contour => {
        const points = contour.getPoints();
        return {
            center: {
                x: getCenter(points.map(p => p.x)),
                y: getCenter(points.map(p => p.y)),
            }
        };
    });

    const foundBalls = {
        circles,
        // circle: circles.sort((a, b) => b.size - a.size)[0],
        colorFilteredMat
    };

    return foundBalls;
};
