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
    // cv.imshowWait("", colorFilteredMat);
    const cannyMat = colorFilteredMat.canny(threshold1, threshold2, apertureSize, L2gradient);
    // cv.imshowWait("", cannyMat);

    const mode = cv.RETR_CCOMP;
    const findContoursMethod = cv.CHAIN_APPROX_SIMPLE;
    const foundContours = cannyMat.findContours(mode, findContoursMethod);
    cannyMat.drawContours(foundContours, new cv.Vec3(255, 255, 255));

    let circles = foundContours.map(c => c.fitEllipse());

    // circles = circles.filter(
    //     c =>
    //         c.size > options.houghCircleSettings.minRadius &&
    //         c.size < options.houghCircleSettings.maxRadius
    // );

    // const circles = blobDetector.detect(colorFilteredMat);
    // const circles = [
    //     {
    //         octave: 0,
    //         size: 61.23310470581055,
    //         response: 0,
    //         classId: -1,
    //         angle: -1,
    //         point: { y: 436.63592529296875, x: 350.57281494140625 },
    //         localId: -1
    //     },
    //     {
    //         octave: 0,
    //         size: 119.7121810913086,
    //         response: 0,
    //         classId: -1,
    //         angle: -1,
    //         point: { y: 412.7687683105469, x: 256.1635437011719 },
    //         localId: -1
    //     }
    // ];

    // let res = blobDetector.detect(colorFilteredMat);
    // cv.drawKeyPoints(colorFilteredMat, res);
    // debugger;
    // cv.imshowWait("", colorFilteredMat);

    // now remove the grayness from areas that are not within the sections mask
    // backgroundMat = backgroundMat.copy(sectionsMask);
    // colorFilteredMat = colorFilteredMat.copy(sectionsMask);

    const foundBall = {
        circles,
        circle: circles.sort((a, b) => b.size - a.size)[0],
        mat: undefined,
        matchPercentage: 0,
        backgroundMat: null,
        colorFilteredMat
    };

    return foundBall;
};
