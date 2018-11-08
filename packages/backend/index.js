const cv = require("opencv4nodejs");
const getTransformationMatrixMatNew = require("./lib/getTransformationMatrixMatNew");
const simplifyZones = require("./lib/simplifyZones");
const adjustZonesResolution = require("./lib/adjustZonesResolution");
const findColoredBalls = require("./lib/findColoredBalls");
const visualAid = require("./lib/visualAid");
const setActiveSections = require("./lib/setActiveSections");

const app = require("express")();
const http = require("http").Server(app);
const server = http.listen(8080, function() {
    console.log("listening on *:8080");
});
const io = require("socket.io").listen(server);
const db = require("./db");

require("dotenv").config();

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

// globals
let settings = db.getSettings();

const captureDelay = parseInt(process.env.captureDelay || 0); // 5 is prod-recommended for now
const failedCaptureDelay = parseInt(process.env.failedCaptureDelay || 100);
const frontendResolution = { width: 640, height: 480 };

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
let wCap = null;
if (!JSON.parse(process.env.mockCamera || false)) {
    wCap = new cv.VideoCapture(devicePort);
}

// apply settings to camera etc.
const applySettingsToCamera = () => {
    // more generic settings for all camera options, works better, no?
    if (settings.cameraSettings) {
        const currentCameraSettings = getCameraProperties();

        Object.keys(settings.cameraSettings).forEach(cameraSettingName => {
            // does the property currently exist in opencv, and has it changed from the current setting?
            if (
                cv[cameraSettingName] &&
                currentCameraSettings[cameraSettingName] !==
                    settings.cameraSettings[cameraSettingName]
            ) {
                wCap.set(cv[cameraSettingName], settings.cameraSettings[cameraSettingName]);
            }
        });
    }

    // as a last safety thing, apply the settings from the camera back again,
    // just in case something didn't stick
    applyCameraPropertiesToSettings();
};
const getCameraProperties = () => {
    const retrievedSettings = {};

    Object.keys(cv)
        .filter(propertyName => propertyName.startsWith("CAP_PROP_"))
        .forEach(propertyName => {
            retrievedSettings[propertyName] = wCap.get(cv[propertyName]);
        });

    return retrievedSettings;
};
const applyCameraPropertiesToSettings = () => {
    if (!settings.cameraSettings) {
        settings.cameraSettings = {};
    }

    settings.cameraSettings = getCameraProperties();

    db.writeSettings(settings);
    io.emit(serverMsg.settings, settings);
};

if (wCap) {
    applySettingsToCamera();
    applyCameraPropertiesToSettings();
}

// for our timings when debugging
const timerIterations = {
    general: 0,
    error: 0,
    ball: 0,
    corner: 0
};

setInterval(() => {
    status.timings.general = timerIterations.general;
    timerIterations.general = 0;
    status.timings.error = timerIterations.error;
    timerIterations.error = 0;
    status.timings.ball = timerIterations.ball;
    timerIterations.ball = 0;
    status.timings.corners = timerIterations.corner;
    timerIterations.corner = 0;
}, 1000);

const cycleMat = (matName, matArray, newMat) => {
    if (matArray[matName] && matArray[matName].release) {
        matArray[matName].release();
    }
    matArray[matName] = newMat;
};

// socket endpoints
io.on(clientMsg.connection, function(socket) {
    console.log("a browser session connected");
    Object.keys(clientMsg).forEach(key => {
        const msg = clientMsg[key];

        /* eslint-disable indent */
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
                            applySettingsToCamera();
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
        /* eslint-enable indent */
    });
});

const useCamera = !JSON.parse(process.env.mockCamera || false);
const getImageAsync = useCamera
    ? () => wCap.readAsync()
    : () => cv.imreadAsync("./board_with_ball.png");

let getImagePromise;

let transformationData;
let skips = 0;
const maxSkips = settings.cornerIdentification.maxSkips;

const track = () => {
    if (getImagePromise === undefined) {
        getImagePromise = getImageAsync();
    }
    getImagePromise.then(board => {
        getImagePromise = getImageAsync();

        if (JSON.parse(process.env.showCapture || false)) {
            const matNames = Object.keys(mats);
            if (matNames.length > 0) {
                matNames.forEach(matName => {
                    if (mats[matName] && mats[matName].constructor.name === "Mat") {
                        cv.imshow(matName, mats[matName]);
                    }
                });
                cv.waitKey(1);
            }
        }

        cycleMat("Image", mats, board);

        // don't show visual aid things while not calibrating
        if (status.calibrationActive > 0 && Number(status.calibrationActive) < new Date() - 3000) {
            console.log("calibration mode off");
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
                        settings.resolution,
                        status.calibrationActive
                    );
                    skips = 0;
                    status.cornerIdentificationFailCount = 0;
                    timerIterations.corner++;
                } catch (e) {
                    // failed to get corners, at least draw lines
                    if (status.calibrationActive) {
                        visualAid.drawBoardLines(mats["Image"], e.lines, new cv.Vec3(0, 0, 255));
                    }
                    cycleMat("Corners Mask", mats, e.maskedCornersMat);
                    cycleMat("Color Filtered Corners Mask", mats, e.colorFilteredCornersMat);

                    status.cornerIdentificationFailCount++;
                    throw e;
                }
            }

            const {
                transformationMatrixMat,
                maskedCornersMat,
                colorFilteredCornersMat,
                foundCorners,
                corners,
                lines
            } = transformationData;

            // we received a new matrix
            if (mats["Corners Transformation Matrix"] !== transformationMatrixMat) {
                cycleMat("Corners Transformation Matrix", mats, transformationMatrixMat);
                cycleMat("Corners Mask", mats, maskedCornersMat);
                cycleMat("Color Filtered Corners Mask", mats, colorFilteredCornersMat);
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
                    setActiveSections(activeSections, status, settings);

                    if (status.calibrationActive && settings.visualAid.ballCircle) {
                        // around the ball
                        visualAid.drawBalls(mats["2D Image"], ballData.circles);
                    }

                    timerIterations.ball++;
                } else {
                    // ball was NOT found
                    setActiveSections([], status, settings);
                }
            }

            // visual aid to show which corners were recognized
            if (status.calibrationActive && corners && settings.visualAid.cornerRectangles) {
                visualAid.drawBoardCorners(mats["Image"], corners);
                // visualAid.drawBoardCenter(mats["Image"], center);
                visualAid.drawBoardLines(mats["Image"], lines);
            }

            timerIterations.general++;
            status.errorMessage = "";
            if (captureDelay === 0) {
                // do it immediately after the promise is fulfilled
                getImagePromise.then(track);
                // setTimeout(track, 0);
            } else {
                setTimeout(track, captureDelay);
            }
        } catch (e) {
            timerIterations.error++;
            status.errorMessage = e.message;
            console.trace(new Error(e));
            setTimeout(track, failedCaptureDelay);
        }
    });
};
track();
