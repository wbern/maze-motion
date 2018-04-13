const cv = require("opencv4nodejs");
const getTransformationMatrixMat = require("./lib/getTransformationMatrixMat");
const getActiveSections = require("./lib/getActiveSections");
const simplifyZones = require("./lib/simplifyZones");
const adjustZonesResolution = require("./lib/adjustZonesResolution");

const app = require("express")();
const http = require("http").Server(app);
const server = http.listen(8080, function() {
    console.log("listening on *:8080");
});
const io = require("socket.io").listen(server);
const db = require("./db");

// globals
const captureDelay = parseInt(process.env.captureDelay || 5); // 5 is prod-recommended for now
const failedCaptureDelay = 1000;
const frontendResolution = { height: 480, width: 640 };
const backendResolution = { height: 480, width: 640 };
const retrievedMats = {};
let lastActiveSections;

// endpoints
app.get("/image", function(req, res) {
    if (retrievedMats["2D Image"]) {
        const image = cv.imencode(".jpg", retrievedMats["2D Image"]);
        const base64 = new Buffer(image).toString("base64");
        res.status(200).send(base64);
    } else {
        const mat = wCap.read();
        const image = cv.imencode(".jpg", mat);
        // let base64Image = Buffer.from(cv.imencode(".png", mat)).toString();
        const base64Image = new Buffer(image).toString("base64");
        res.status(200).send(base64Image);
    }
});

// socket endpoints
io.on("connection", function(socket) {
    console.log("a user connected");
    socket.on("saveSection", data => {
        // webpage wants to save section data
        data.zones = adjustZonesResolution(data.zones, data.resolution, backendResolution);
        data.zones = simplifyZones(
            data.zones,
            data.resolution,
            backendResolution,
            frontendResolution
        );
        db.writeSection(data.index, data.zones);
    });

    socket.on("loadSection", index => {
        console.log("loadSection");
        const section = db.getSection(index);
        if (section) {
            const zones = adjustZonesResolution(
                section.zones,
                backendResolution,
                frontendResolution
            );
            socket.emit("loadedSection", { index, zones });
        }
    });

    socket.on("saveCornerHSVMasks", data => {
        db.writeCornerHSVMasks(data);
    });

    socket.on("requestCornerHSVMasks", data => {
        socket.emit("cornerHSVMasks", db.getCornerHSVMasks(data));
    });

    socket.on("requestImage", data => {
        if (data.cameraViewMode && retrievedMats[data.cameraViewMode]) {
            socket.emit(
                "activeImage",
                new Buffer(cv.imencode(".png", retrievedMats[data.cameraViewMode]))
            );
        }
    });

    socket.on("requestCornerStatus", () => {
        if (staleTransformationMatrixCount === 0) {
            socket.emit("cornerStatus", "ok");
        } else if (staleTransformationMatrixCount < 10) {
            socket.emit("cornerStatus", "warn");
        } else {
            socket.emit("cornerStatus", "err");
        }
    });

    socket.on("requestActiveSections", () => {
        socket.emit("activeSections", lastActiveSections);
    });
});

// open capture from webcam
const devicePort = parseInt(process.env.devicePort || 0);
const wCap = new cv.VideoCapture(devicePort);
wCap.set(cv.CAP_PROP_FRAME_WIDTH, backendResolution.width);
wCap.set(cv.CAP_PROP_FRAME_HEIGHT, backendResolution.height);
wCap.set(cv.CAP_PROP_SATURATION, 50);
wCap.set(cv.CAP_PROP_CONTRAST, 40);
wCap.set(cv.CAP_PROP_BRIGHTNESS, 120);
// doesn't seem to work
// wCap.set(cv.CAP_PROP_WHITE_BALANCE_BLUE_U, 99);
// wCap.set(cv.CAP_PROP_WHITE_BALANCE_RED_V, 99);

// Brightness = cap.get(CV_CAP_PROP_BRIGHTNESS);
// Contrast   = cap.get(CV_CAP_PROP_CONTRAST );
// Saturation = cap.get(CV_CAP_PROP_SATURATION);
// Gain       = cap.get(CV_CAP_PROP_GAIN);

let staleTransformationMatrixCount = 0;
const staleTransformationMatrixLimit = 10;

let capturesDoneWithinInterval = 0;

setInterval(() => {
    console.log(capturesDoneWithinInterval + " captures per 5 seconds");
    capturesDoneWithinInterval = 0;
}, 5000);

const fetchActiveSection = () => {
    wCap.readAsync().then(imageMat => {
        const hsvFrame = imageMat.cvtColor(cv.COLOR_BGR2HSV_FULL);
        let ballMat;

        retrievedMats["Image"] = imageMat;

        try {
            try {
                const { transformationMatrixMat, maskedCornersMat } = getTransformationMatrixMat(
                    imageMat,
                    db.getCornerHSVMasks(),
                    backendResolution
                );
                retrievedMats["Corners Transformation Matrix"] = transformationMatrixMat;
                retrievedMats["Corners Mask"] = maskedCornersMat;
                staleTransformationMatrixCount = 0;
            } catch (e) {
                staleTransformationMatrixCount++;
                if (!retrievedMats["Corners Transformation Matrix"]) {
                    throw Error(
                        "Failed getting initial corner capture: (count: " +
                            staleTransformationMatrixCount +
                            ")"
                    );
                } else if (staleTransformationMatrixCount > staleTransformationMatrixLimit) {
                    throw Error(
                        "Failed to get corners " +
                            staleTransformationMatrixLimit +
                            " times, discarding capture (count: " +
                            staleTransformationMatrixCount +
                            ")"
                    );
                }
                console.warn(e);
            }

            let flatImageMat = imageMat.warpPerspective(
                retrievedMats["Corners Transformation Matrix"],
                new cv.Size(backendResolution.width, backendResolution.height),
                // http://tanbakuchi.com/posts/comparison-of-openv-interpolation-algorithms/#Upsampling-comparison
                cv.INTER_CUBIC
            );
            flatImageMat = flatImageMat
                .resize(backendResolution.height, backendResolution.width * 1.3)
                .getRegion(new cv.Rect(0, 0, backendResolution.width, backendResolution.height));

            // now try to normalize the flat image to have as many circular holes as possible
            const args = [
                // method: Define the detection method. Currently this is the only one available in OpenCV
                cv.HOUGH_GRADIENT,
                // dp: The inverse ratio of resolution
                1,
                // minDist: Minimum distance between detected centers
                // retrievedMats["2D Image"].rows / 8,
                5,
                // param1: Upper threshold for the internal Canny edge detector
                30,
                // param2: Threshold for center detection.
                17,
                // minRadius: Minimum radius to be detected. If unknown, put zero as default.
                9,
                // maxRadius: Maximum radius to be detected. If unknown, put zero as default
                13
            ];

            // mark a range of grays as completely white, onto the forCirclesMat
            const circlesMat = flatImageMat
                // houghCircles requires grayscale
                .cvtColor(cv.COLOR_BGR2GRAY)
                // remove all existing pure-white colorings in the image
                .threshold(254, 255, cv.THRESH_TRUNC);

            // create mat with relevant grays as white
            let relevantGraynessMask = flatImageMat
                .cvtColor(cv.COLOR_BGR2HSV_FULL)
                .gaussianBlur(new cv.Size(1, 1), 2, 2);
            relevantGraynessMask = relevantGraynessMask.inRange(
                new cv.Vec3(0, 0, 95),
                new cv.Vec3(255, 80, 125)
            );

            const yScale = 1;
            let xScale = 1;
            const trimCircleEdgePercentage = 0.2;
            const minPaletteCount = 20;
            const maxPaletteCount = 999;
            const maxPercentage = 0.85;
            const minPercentage = 0.1;
            const grayestCircle = { circle: undefined, mat: undefined, matchPercentage: 0 };

            while (xScale > 0.95) {
                xScale -= 0.01;

                const scaledCirclesMat = circlesMat.resize(
                    parseInt(backendResolution.height * yScale),
                    parseInt(backendResolution.width * xScale)
                );
                const foundCircles = circlesMat.houghCircles.apply(scaledCirclesMat, args);

                // iterate each circle
                // check if it contains a lot of non-black/dark
                // record it as "grayestCircle".

                // visual aid
                foundCircles.forEach(circle => {
                    // make a mask mat with same size as the old one
                    const circleMask = new cv.Mat(
                        scaledCirclesMat.rows,
                        scaledCirclesMat.cols,
                        cv.CV_8U
                    );
                    // make sure it's pitch black everywhere
                    circleMask.drawRectangle(
                        new cv.Point2(0, 0),
                        new cv.Point2(scaledCirclesMat.sizes[1], scaledCirclesMat.sizes[0]),
                        new cv.Vec3(0, 0, 0),
                        -1
                    );
                    // draw a white circle on the mask where the current circle is, with variable offset
                    circleMask.drawCircle(
                        new cv.Point2(circle.x, circle.y),
                        parseInt(circle.z * (1 - trimCircleEdgePercentage)),
                        new cv.Vec3(255, 255, 255),
                        -1000
                    );

                    // create a circle background with a near-perfect white, which won't be taken into
                    // account when matching amount of ball-perceived grayness
                    const singleCircleMatBackground = new cv.Mat(
                        scaledCirclesMat.rows,
                        scaledCirclesMat.cols,
                        cv.CV_8U
                    );
                    singleCircleMatBackground.drawRectangle(
                        new cv.Point2(0, 0),
                        new cv.Point2(scaledCirclesMat.sizes[1], scaledCirclesMat.sizes[0]),
                        new cv.Vec3(254, 254, 254),
                        -1
                    );

                    // get a mat of only the current circle with relevant grayness only
                    const singleCircleWithRelevantWhitesMat = relevantGraynessMask
                        .resize(
                            parseInt(backendResolution.height * yScale),
                            parseInt(backendResolution.width * xScale)
                        )
                        .copyTo(singleCircleMatBackground, circleMask);

                    const matches = singleCircleWithRelevantWhitesMat
                        .inRange(255, 255)
                        .countNonZero();
                    // get amount of non-matching grayness, but not the blackness outside the circle
                    const nonMatches = singleCircleWithRelevantWhitesMat
                        .inRange(0, 253)
                        .countNonZero();
                    // get percent of circle that has matching grayness
                    const matchPercentage = matches / (matches + nonMatches);

                    // is the circle's grayness percentage within the acceptable range?
                    if (matchPercentage >= minPercentage && matchPercentage <= maxPercentage) {
                        // get a mat of only the current circle with all colors in grayscale
                        const singleCircleWithAllColors = scaledCirclesMat.copyTo(
                            singleCircleMatBackground,
                            circleMask
                        );
                        const paletteCount = new Set(singleCircleWithAllColors.getData()).size - 2;

                        // is the circle palette that of a metal sphere?
                        if (paletteCount >= minPaletteCount && paletteCount <= maxPaletteCount) {
                            // does this circle have more grayness than any previous circle?
                            if (matchPercentage > grayestCircle.matchPercentage) {
                                // save references to this circle's data
                                grayestCircle.matchPercentage = matchPercentage;
                                // grayestCircle.hitMissMat = hitMissMat;
                                grayestCircle.moments = singleCircleWithRelevantWhitesMat.moments();
                                grayestCircle.roundedMatchPercentage =
                                    Math.round(matchPercentage * 100) / 100;
                                grayestCircle.mat = singleCircleWithRelevantWhitesMat;
                                // restore the x to the original image x axis scale before storing the reference
                                grayestCircle.circle = {
                                    x: circle.x / xScale,
                                    y: circle.y,
                                    z: circle.z / (1 - trimCircleEdgePercentage)
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
            }

            if (grayestCircle.circle) {
                flatImageMat.drawCircle(
                    new cv.Point2(grayestCircle.circle.x, grayestCircle.circle.y),
                    grayestCircle.circle.z * 1,
                    new cv.Vec3(255, 0, 0),
                    2
                );

                console.log(
                    "Ball identification grayness match percentage: " +
                        grayestCircle.roundedMatchPercentage * 100 +
                        "% (moments: " +
                        Object.keys(grayestCircle.moments).length +
                        ")"
                );
            }

            retrievedMats["2D Image"] = flatImageMat;

            const hsvMasks = db.getBallHSVMasks();
            hsvMasks.forEach(hsvMask => {
                const min = new cv.Vec3(hsvMask.min[0], hsvMask.min[1], hsvMask.min[2]);
                const max = new cv.Vec3(hsvMask.max[0], hsvMask.max[1], hsvMask.max[2]);
                const rangeMask = hsvFrame.inRange(min, max);
                ballMat = flatImageMat.copyTo(ballMat || new cv.Mat(), rangeMask);
            });

            retrievedMats["Ball Mask"] = ballMat;

            getActiveSections(db.getSections(), retrievedMats["Ball Mask"].bgrToGray()).then(
                activeSections => {
                    // only emit something if there's a change
                    lastActiveSections = activeSections
                        .map((matchCount, activeSectionIndex) => {
                            if (matchCount !== undefined) {
                                const section = db.getSection(activeSectionIndex);
                                const zones = adjustZonesResolution(
                                    section.zones,
                                    backendResolution,
                                    frontendResolution
                                );

                                return { index: activeSectionIndex, zones };
                            }
                            return null;
                        })
                        .filter(s => s !== null);
                    capturesDoneWithinInterval++;
                    setTimeout(fetchActiveSection, captureDelay);
                }
            );
        } catch (e) {
            console.warn(e);
            setTimeout(fetchActiveSection, failedCaptureDelay);
        }
    });
};
fetchActiveSection();
