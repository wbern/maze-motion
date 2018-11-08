const cv = require("opencv4nodejs");

module.exports = (boardImage, sections, options) => {
    let colorFilteredMat = boardImage.cvtColor(cv.COLOR_BGR2HSV_FULL);

    let temp = new cv.Mat(boardImage.rows, boardImage.cols, cv.CV_8U);
    options.ballHSVMasks.forEach(hsvMask => {
        const min = new cv.Vec3(hsvMask.min[0], hsvMask.min[1], hsvMask.min[2]);
        const max = new cv.Vec3(hsvMask.max[0], hsvMask.max[1], hsvMask.max[2]);
        const rangeMask = colorFilteredMat.inRange(min, max);
        temp = colorFilteredMat.copyTo(temp, rangeMask);
    });
    colorFilteredMat = temp.bgrToGray().threshold(1, 255, cv.THRESH_BINARY);

    const cannyMat = colorFilteredMat.canny(options.cannyThreshold1, options.cannyThreshold2, options.cannyApertureSize, options.cannyL2gradient);

    // don't change these
    const mode = cv.RETR_CCOMP;
    const findContoursMethod = cv.CHAIN_APPROX_NONE;
    const foundContours = cannyMat.findContours(mode, findContoursMethod);
    cannyMat.drawContours(foundContours, new cv.Vec3(255, 255, 255));

    // create geometric center in order to figure out the angles
    const getCenter = arr =>
        arr.reduce((total = 0, curr, index, arr) => {
            total += arr[index - 1] ? Math.abs(curr - arr[index - 1]) : 0; // x

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
