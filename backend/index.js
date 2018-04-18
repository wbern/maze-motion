const cv = require("opencv4nodejs");
const getTransformationMatrixMat = require("./lib/getTransformationMatrixMat");
const simplifyZones = require("./lib/simplifyZones");
const adjustZonesResolution = require("./lib/adjustZonesResolution");
const findBall = require("./lib/findBall");

const app = require("express")();
const http = require("http").Server(app);
const server = http.listen(8080, function() {
    console.log("listening on *:8080");
});
const io = require("socket.io").listen(server);
const db = require("./db");

// globals
let settings = db.getSettings();

const captureDelay = parseInt(process.env.captureDelay || 5); // 5 is prod-recommended for now
const failedCaptureDelay = 1000;
const frontendResolution = { height: 480, width: 640 };

// these get updated throughout the back-end runtime
const mats = {};

const status = {
    activeSections: [],
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
//         const base64 = new Buffer(image).toString("base64");
//         res.status(200).send(base64);
//     } else {
//         const mat = wCap.read();
//         const image = cv.imencode(".jpg", mat);
//         // let base64Image = Buffer.from(cv.imencode(".png", mat)).toString();
//         const base64Image = new Buffer(image).toString("base64");
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
    status: "status",
    settings: "settings"
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
                    data.zones = simplifyZones(
                        data.zones,
                        data.resolution,
                        settings.resolution,
                        frontendResolution
                    );
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
                        socket.emit(
                            serverMsg.activeImage,
                            new Buffer(cv.imencode(".png", mats[data.cameraViewMode]))
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
                }
            }.bind(this)
        );
    });
});

const track = () => {
    wCap.readAsync().then(board => {
        mats["Image"] = board;

        try {
            // get image transformation using corners
            const {
                transformationMatrixMat,
                maskedCornersMat,
                foundCorners,
                foundContours
            } = getTransformationMatrixMat(
                mats["Image"],
                settings.cornerIdentification,
                settings.resolution
            );
            mats["Corners Transformation Matrix"] = transformationMatrixMat;
            mats["Corners Mask"] = maskedCornersMat;
            status.foundCorners = foundCorners;

            // visual aid to show which corners were recognized
            if (foundContours && settings.visualAid.cornerRectangles) {
                foundContours.forEach(c => {
                    const bounds = c.boundingRect();
                    mats["Image"].drawRectangle(
                        new cv.Point2(bounds.x, bounds.y),
                        new cv.Point2(bounds.x + bounds.width, bounds.y + bounds.height),
                        new cv.Vec(255, 0, 0),
                        2
                    );
                });
            }

            if (mats["Corners Transformation Matrix"]) {
                status.cornerIdentificationFailCount = 0;
                cornerTrackingsPerSecond++;
            } else {
                status.cornerIdentificationFailCount++;
            }

            if (mats["Corners Transformation Matrix"]) {
                // we have the 2D transformation matrix, make the board 2D
                mats["2D Image"] = mats["Image"].warpPerspective(
                    mats["Corners Transformation Matrix"],
                    new cv.Size(settings.resolution.width, settings.resolution.height),
                    // http://tanbakuchi.com/posts/comparison-of-openv-interpolation-algorithms/#Upsampling-comparison
                    cv.INTER_CUBIC
                );

                const sections = db.getSections();

                const ball = findBall(mats["2D Image"], sections, settings.ballIdentification);
                mats["Ball Background Mask"] = ball.backgroundMat;
                mats["Ball Color Filtered Mask"] = ball.colorFilteredMat;

                if (ball.circle) {
                    mats["Ball Mask"] = ball.mat;

                    // get active sections
                    const activeSections = Object.keys(sections).filter(sectionName =>
                        sections[sectionName].zones.some(
                            zone =>
                                ball.circle.x >= zone.x &&
                                ball.circle.x <= zone.x + zone.width &&
                                (ball.circle.y >= zone.y && ball.circle.y <= zone.y + zone.height)
                        )
                    );

                    // save new active sections if there was a change
                    if (
                        activeSections.length !== status.activeSections.length ||
                        activeSections.some(
                            activeSectionName => !status.activeSections.includes(activeSectionName)
                        )
                    ) {
                        status.activeSections = activeSections;
                    }

                    if (settings.visualAid.ballCircle) {
                        // around the ball
                        mats["2D Image"].drawCircle(
                            new cv.Point2(ball.circle.x, ball.circle.y),
                            ball.circle.z * 1,
                            new cv.Vec3(255, 0, 0),
                            2
                        );

                        // center of ball
                        mats["2D Image"].drawCircle(
                            new cv.Point2(ball.circle.x, ball.circle.y),
                            1,
                            new cv.Vec3(255, 255, 0),
                            2
                        );

                        // percentage match
                        mats["2D Image"].putText(
                            ball.roundedMatchPercentage * 100 + "%",
                            new cv.Point2(ball.circle.x, ball.circle.y + ball.circle.z + 12),
                            cv.FONT_HERSHEY_PLAIN,
                            1,
                            new cv.Vec3(255, 0, 0)
                        );
                    }

                    ballTrackingsPerSecond++;
                }
            }

            generalTrackingsPerSecond++;
            status.errorMessage = "";
            setTimeout(track, captureDelay);
        } catch (e) {
            errorTrackingsPerSecond++;
            status.errorMessage = e;
            console.error(e);
            setTimeout(track, failedCaptureDelay);
        }
    });
};
track();
