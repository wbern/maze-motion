const cv = require("opencv4nodejs");
const getTransformationMatrixMat = require("./lib/getTransformationMatrixMat");
const getActiveSections = require("./lib/getActiveSections");
const simplifyZones = require("./lib/simplifyZones");
const adjustZonesResolution = require("./lib/adjustZonesResolution");

var app = require("express")();
var http = require("http").Server(app);
var server = http.listen(8080, function() {
    console.log("listening on *:8080");
});
var io = require("socket.io").listen(server);
var db = require("./db");

// globals
const frontendResolution = { height: 480, width: 640 };
const backendResolution = { height: 480, width: 640 };
let lastRetrievedImageMat;
let lastRetrievedBallMat;
let lastActiveSections;

// endpoints
app.get("/image", function(req, res) {
    if (lastRetrievedImageMat) {
        const image = cv.imencode(".jpg", lastRetrievedImageMat);
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

    socket.on("requestImage", data => {
        if (lastRetrievedBallMat) {
            if (data.showMaskedImage) {
                const image = cv.imencode(".jpg", lastRetrievedBallMat);
                const base64 = new Buffer(image).toString("base64");
                socket.emit("activeImageMask", base64);
            } else {
                const image = cv.imencode(".jpg", lastRetrievedImageMat);
                const base64 = new Buffer(image).toString("base64");
                socket.emit("activeImage", base64);
            }
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
const devicePort = 1;
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

// const defaults = {
//     detectShadows: true,
//     history: 500,
//     varThreshold: 16
// };
const modified = {
    detectShadows: false,
    history: 50,
    varThreshold: 50
};
const mog2 = new cv.BackgroundSubtractorMOG2(
    modified.history,
    modified.varThreshold,
    modified.detectShadows
);
let ballMotionMat;
let lastTransformationMatrixMat;
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

        // cv.imshowWait("image", imageMat);

        try {
            try {
                lastTransformationMatrixMat = getTransformationMatrixMat(
                    imageMat,
                    db.getCornerHSVMasks(),
                    backendResolution
                );
                staleTransformationMatrixCount = 0;
            } catch (e) {
                staleTransformationMatrixCount++;
                if (!lastTransformationMatrixMat) {
                    throw Error(
                        "Failed getting initial corner capture (count: " +
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

            imageMat = imageMat.warpPerspective(
                lastTransformationMatrixMat,
                new cv.Size(backendResolution.width, backendResolution.height),
                // http://tanbakuchi.com/posts/comparison-of-openv-interpolation-algorithms/#Upsampling-comparison
                cv.INTER_CUBIC
            );

            lastRetrievedImageMat = imageMat;

            const hsvMasks = db.getBallHSVMasks();
            hsvMasks.forEach(hsvMask => {
                const min = new cv.Vec3(hsvMask.min[0], hsvMask.min[1], hsvMask.min[2]);
                const max = new cv.Vec3(hsvMask.max[0], hsvMask.max[1], hsvMask.max[2]);
                const rangeMask = hsvFrame.inRange(min, max);
                ballMat = imageMat.copyTo(ballMat || new cv.Mat(), rangeMask);
            });

            lastRetrievedBallMat = ballMat;
            ballMotionMat = mog2.apply(ballMat);

            getActiveSections(db.getSections(), ballMotionMat).then(activeSections => {
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
                // console.log(JSON.stringify(lastActiveSections.map(s => s.index)));
                setTimeout(fetchActiveSection, 5);
            });
        } catch (e) {
            console.warn(e);
            setTimeout(fetchActiveSection, 1000);
        }
    });
};
fetchActiveSection();

// let mask = mog2.apply(frame1);
// mask = mog2.apply(frame2);
// cv.imshowWait("diff", mask);

// mongo-db related
// const MongoClient = require("mongodb").MongoClient;
// const assert = require("assert");

// // Connection URL
// var url = "mongodb://localhost:27017/myproject";
// // Use connect method to connect to the Server
// MongoClient.connect(url, function(err, db) {
//     assert.equal(null, err);
//     console.log("Connected correctly to server");

//     db.close();
// });

// only get reasonable high values, above mean
// ret,self.acc_thresh=cv2.threshold(self.ab,self.ab.mean(),255,cv2.THRESH_TOZERO)

// make a color map
// cv.applyColorMap();
