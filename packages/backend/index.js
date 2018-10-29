const cv = require("opencv4nodejs");
const getTransformationMatrixMatNew = require("./lib/getTransformationMatrixMatNew");
const simplifyZones = require("./lib/simplifyZones");
const adjustZonesResolution = require("./lib/adjustZonesResolution");
const findColoredBalls = require("./lib/findColoredBalls");

const app = require("express")();
const http = require("http").Server(app);
const server = http.listen(8080, function() {
    console.log("listening on *:8080");
});
const io = require("socket.io").listen(server);
const db = require("./db");

// globals
let settings = db.getSettings();

const captureDelay = parseInt(process.env.captureDelay || 0); // 5 is prod-recommended for now
const failedCaptureDelay = 100;
const frontendResolution = { height: 480, width: 640 };

// these get updated throughout the back-end runtime
const mats = {};

const status = {
    activeSections: [],
    lastActiveSections: [],
    normalizedActiveSections: [],
    timings: {
        general: -1,
        error: -1,
        ball: -1,
        corners: -1
    },
    cornerIdentificationFailCount: 0,
    cornerStatus: () => {
        if (status.cornerIdentificationFailCount === 0) {
            return "ok";
        } else if (status.cornerIdentificationFailCount < 10) {
            return "warn";
        } else {
            return "err";
        }
    }
};

// open capture from camera
const devicePort = parseInt(process.env.devicePort || 0);
const wCap = new cv.VideoCapture(devicePort);

// apply settings to camera etc.
const applySettings = () => {
    wCap.set(cv.CAP_PROP_FRAME_WIDTH, settings.resolution.width);
    wCap.set(cv.CAP_PROP_FRAME_HEIGHT, settings.resolution.height);
    if (settings.cameraSaturation) {
        wCap.set(cv.CAP_PROP_SATURATION, settings.cameraSaturation);
    }
    if (settings.cameraContrast) {
        wCap.set(cv.CAP_PROP_CONTRAST, settings.cameraContrast);
    }
    if (settings.cameraBrightness) {
        wCap.set(cv.CAP_PROP_BRIGHTNESS, settings.cameraBrightness);
    }
    if (settings.cameraGain) {
        wCap.set(cv.CV_CAP_PROP_GAIN, settings.cameraGain);
    }
};
applySettings();

// for our timings when debugging
let generalTrackingsPerSecond = 0;
let errorTrackingsPerSecond = 0;
let ballTrackingsPerSecond = 0;
let cornerTrackingsPerSecond = 0;

setInterval(() => {
    console.log("timing:", generalTrackingsPerSecond);
    status.timings.general = generalTrackingsPerSecond;
    generalTrackingsPerSecond = 0;
    status.timings.error = errorTrackingsPerSecond;
    errorTrackingsPerSecond = 0;
    status.timings.ball = ballTrackingsPerSecond;
    ballTrackingsPerSecond = 0;
    status.timings.corners = cornerTrackingsPerSecond;
    cornerTrackingsPerSecond = 0;
}, 1000);

// endpoints, who needs them though?
// app.get("/image", function(req, res) {
//     if (retrievedMats["2D Image"]) {
//         const image = cv.imencode(".jpg", retrievedMats["2D Image"]);
//         const base64 = Buffer.from(image).toString("base64");
//         res.status(200).send(base64);
//     } else {
//         const mat = wCap.read();
//         const image = cv.imencode(".jpg", mat);
//         // let base64Image = Buffer.from(cv.imencode(".png", mat)).toString();
//         const base64Image = Buffer.from(image).toString("base64");
//         res.status(200).send(base64Image);
//     }
// });

const clientMsg = {
    connection: "connection",
    disconnect: "disconnect",
    saveSection: "saveSection",
    loadSection: "loadSection",
    requestSections: "requestSections",
    requestImage: "requestImage",
    requestCornerStatus: "requestCornerStatus",
    requestActiveSections: "requestActiveSections",
    requestActiveSectionsWithoutZoneData: "requestActiveSectionsWithoutZoneData",
    requestActiveSectionsNormalizedWithoutZoneData:
        "requestActiveSectionsNormalizedWithoutZoneData",
    requestStatus: "requestStatus",
    requestSettings: "requestSettings",
    saveSettings: "saveSettings"
};

const serverMsg = {
    loadedSection: "loadedSection",
    sections: "sections",
    activeImage: "activeImage",
    cornerStatus: "cornerStatus",
    activeSections: "activeSections",
    activeSectionsWithoutZoneData: "activeSectionsWithoutZoneData",
    activeSectionsNormalizedWithoutZoneData: "activeSectionsNormalizedWithoutZoneData",
    status: "status",
    settings: "settings"
};

const setActiveSections = activeSections => {
    // set active sections and a normalized array as well
    status.activeSections = activeSections;

    // set a normalized value based on previous captures
    const normalizeValue = settings.sectionIdentification.normalizationValue;

    // add the newest to the history
    status.lastActiveSections.unshift(activeSections);

    if (status.lastActiveSections.length >= normalizeValue) {
        // we have enough captures to make a normalized result
        if (status.lastActiveSections.length > normalizeValue) {
            // Remove entries larger than the normalization value
            status.lastActiveSections.splice(normalizeValue);
        }

        // get occurence list of all active sections
        const sectionsOccurenceCount = status.lastActiveSections.reduce((prev, currSections) => {
            return currSections.reduce((prev, currSectionNumber) => {
                prev[currSectionNumber] = (prev[currSectionNumber] || 0) + 1;
                return prev;
            }, prev);
        }, {});

        // find the occurences that are consistently present in all last active sections
        const alwaysPresentSections = [];
        Object.keys(sectionsOccurenceCount).forEach(sectionName => {
            if (sectionsOccurenceCount[sectionName] === normalizeValue) {
                alwaysPresentSections.push(sectionName);
            }
        });

        // remove sections that are completely gone from the last X captures
        status.normalizedActiveSections = status.normalizedActiveSections.filter(
            normalizedSection => {
                if (!sectionsOccurenceCount[normalizedSection]) {
                    // old normalized section is not present at all anymore
                    return false;
                }
                return true;
            }
        );

        // add the always present sections in
        alwaysPresentSections.forEach(alwaysPresentSection => {
            if (!status.normalizedActiveSections.includes(alwaysPresentSection)) {
                // section is not previously in the array, add it in
                status.normalizedActiveSections.push(alwaysPresentSection);
            }
        });
    }

    // debugging
    // console.log(
    //     "Normalized: " +
    //         JSON.stringify(status.normalizedActiveSections) +
    //         ", Raw: " +
    //         JSON.stringify(status.activeSections)
    // );
};

const cycleMat = (matName, matArray, newMat) => {
    if (matArray[matName] && matArray[matName].release) {
        matArray[matName].release();
    }
    matArray[matName] = newMat;
};

// socket endpoints
io.on(clientMsg.connection, function(socket) {
    console.log("a user connected");
    Object.keys(clientMsg).forEach(key => {
        const msg = clientMsg[key];

        socket.on(
            msg,
            function(data) {
                switch (msg) {
                    case clientMsg.disconnect:
                        socket.removeAllListeners();
                        socket.disconnect();
                        // Object.keys(clientMsg).forEach(key => {
                        //     const msg = clientMsg[key];
                        //     socket.off(msg);
                        // })
                        break;
                    case clientMsg.requestSettings:
                        socket.emit(serverMsg.settings, db.getSettings());
                        break;
                    case clientMsg.saveSettings:
                        try {
                            // parse new settings
                            const newSettings = data;
                            // write new settings to db
                            db.writeSettings(newSettings);
                            // use the new settings
                            settings = newSettings;
                            applySettings();
                        } catch (e) {
                            status.errorMessage = "Invalid settings were not saved.";
                        }

                        // return currently used settings in runtime
                        socket.emit(serverMsg.settings, settings);

                        break;
                    case clientMsg.saveSection:
                        data.zones = adjustZonesResolution(
                            data.zones,
                            data.resolution,
                            settings.resolution
                        );
                        data.zones = simplifyZones(data.zones);
                        db.writeSection(data.index, data.zones);
                        socket.emit(serverMsg.sections, db.getSections());
                        break;
                    // eslint-disable-next-line no-case-declarations
                    case clientMsg.requestStatus:
                        const evaluatedStatus = {};
                        Object.keys(status).forEach(key => {
                            if (typeof status[key] === "function") {
                                evaluatedStatus[key] = status[key]();
                            } else {
                                evaluatedStatus[key] = status[key];
                            }
                        });

                        socket.emit(serverMsg.status, evaluatedStatus);
                        break;
                    // eslint-disable-next-line no-case-declarations
                    case clientMsg.loadSection:
                        const index = data;
                        const section = db.getSection(index);
                        if (section) {
                            const zones = adjustZonesResolution(
                                section.zones,
                                settings.resolution,
                                frontendResolution
                            );
                            socket.emit(serverMsg.loadedSection, { index, zones });
                        }
                        break;
                    case clientMsg.requestSections:
                        socket.emit(serverMsg.sections, db.getSections());
                        break;
                    case clientMsg.requestImage:
                        if (data.cameraViewMode && mats[data.cameraViewMode]) {
                            status.calibrationActive = new Date();
                            socket.emit(
                                serverMsg.activeImage,
                                Buffer.from(cv.imencode(".png", mats[data.cameraViewMode]))
                            );
                        }
                        break;
                    case clientMsg.requestActiveSections:
                        // send back active sections with respective zones
                        socket.emit(
                            serverMsg.activeSections,
                            status.activeSections.map(activeSectionIndex => {
                                const section = db.getSection(activeSectionIndex);
                                const zones = adjustZonesResolution(
                                    section.zones,
                                    settings.resolution,
                                    frontendResolution
                                );

                                return { index: activeSectionIndex, zones };
                            })
                        );
                        break;
                    case clientMsg.requestActiveSectionsWithoutZoneData:
                        socket.emit(serverMsg.activeSectionsWithoutZoneData, status.activeSections);
                        break;
                    case clientMsg.requestActiveSectionsNormalizedWithoutZoneData:
                        socket.emit(
                            serverMsg.activeSectionsNormalizedWithoutZoneData,
                            status.normalizedActiveSections
                        );
                        break;
                }
            }.bind(this)
        );
    });
});

const useCamera = false;
const getImageAsync = useCamera
    ? () => wCap.readAsync()
    : () => cv.imreadAsync("./board_with_ball.png");

let getImagePromise;

let transformationData;
let skips = 0;
const maxSkips = 10;

const track = () => {
    if (getImagePromise === undefined) {
        getImagePromise = getImageAsync();
    }
    getImagePromise.then(board => {
        getImagePromise = getImageAsync();

        cycleMat("Image", mats, board);

        // don't show visual aid things while not calibrating
        if (status.calibrationActive > 0 && Number(status.calibrationActive) < new Date() - 3000) {
            status.calibrationActive = 0;
        }

        try {
            // get image transformation using corners
            // Cost: 30 FPS, 90-120 -> 50-60
            skips++;

            if (!transformationData || skips >= maxSkips) {
                try {
                    transformationData = getTransformationMatrixMatNew(
                        mats["Image"],
                        settings.cornerIdentification,
                        settings.resolution
                    );
                    skips = 0;
                    status.cornerIdentificationFailCount = 0;
                    cornerTrackingsPerSecond++;
                } catch (e) {
                    // failed to get corners
                    status.cornerIdentificationFailCount++;
                    throw e;
                }
            }

            const {
                transformationMatrixMat,
                maskedCornersMat,
                foundCorners,
                corners,
                lines,
                center
            } = transformationData;

            // we received a new matrix
            if (mats["Corners Transformation Matrix"] !== transformationMatrixMat) {
                cycleMat("Corners Transformation Matrix", mats, transformationMatrixMat);
                cycleMat("Corners Mask", mats, maskedCornersMat);
            }

            status.foundCorners = foundCorners;

            if (mats["Corners Transformation Matrix"]) {
                // we have the 2D transformation matrix, make the board 2D
                cycleMat(
                    "2D Image",
                    mats,
                    mats["Image"].warpPerspective(
                        mats["Corners Transformation Matrix"],
                        new cv.Size(settings.resolution.width, settings.resolution.height),
                        // http://tanbakuchi.com/posts/comparison-of-openv-interpolation-algorithms/#Upsampling-comparison
                        cv.INTER_NEAREST
                    )
                );

                const pigeonHoledSections = db.getPigeonHoledSections(
                    frontendResolution.width,
                    frontendResolution.height
                );

                // Cost: 5-10 FPS
                const ballData = findColoredBalls(
                    mats["2D Image"],
                    null,
                    settings.ballIdentification
                );
                // cycleMat("Ball Background Mask", mats, ball.backgroundMat);
                cycleMat("Ball Color Filtered Mask", mats, ballData.colorFilteredMat);

                if (ballData.circles && ballData.circles.length > 0) {
                    // ball was found
                    cycleMat("Ball Mask", mats, ballData.mat);

                    // get active sections
                    const activeSections = Object.keys(
                        ballData.circles.reduce((collection, circle) => {
                            return {
                                ...collection,
                                ...pigeonHoledSections[parseInt(circle.center.x)][
                                    parseInt(circle.center.y)
                                ]
                            };
                        }, {})
                    );

                    // set new active sections if there was a change
                    setActiveSections(activeSections);

                    if (status.calibrationActive && settings.visualAid.ballCircle) {
                        // around the ball
                        ballData.circles.forEach(circle => {
                            mats["2D Image"].drawEllipse(circle, new cv.Vec3(255, 0, 0), 2);
                            mats["2D Image"].drawCircle(
                                new cv.Point2(circle.center.x, circle.center.y),
                                1,
                                new cv.Vec3(255, 255, 0),
                                2
                            );
                        });
                    }

                    ballTrackingsPerSecond++;
                } else {
                    // ball was NOT found
                    setActiveSections([]);
                }
            }

            // visual aid to show which corners were recognized
            if (status.calibrationActive && corners && settings.visualAid.cornerRectangles) {
                corners.forEach(point => {
                    mats["Image"].drawCircle(
                        new cv.Point2(point.x, point.y),
                        3,
                        new cv.Vec3(255, 0, 0),
                        2
                    );
                });

                mats["Image"].drawCircle(
                    new cv.Point2(center.x, center.y),
                    8,
                    new cv.Vec3(255, 0, 255),
                    2
                );

                lines.forEach(line => {
                    mats["Image"].drawLine(
                        new cv.Point2(line.x1, line.y1),
                        new cv.Point2(line.x2, line.y2),
                        new cv.Vec3(255, 0, 0),
                        1
                    );
                });
            }

            generalTrackingsPerSecond++;
            status.errorMessage = "";
            if (captureDelay === 0) {
                // do it immediately after the promise is fulfilled
                getImagePromise.then(track);
                // setTimeout(track, 0);
            } else {
                setTimeout(track, captureDelay);
            }
        } catch (e) {
            errorTrackingsPerSecond++;
            status.errorMessage = e;
            console.trace(e);
            setTimeout(track, failedCaptureDelay);
        }
    });
};
track();
