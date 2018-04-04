const cv = require("opencv4nodejs");
// const path = require("path");
const getActiveSection = require("./lib/getActiveSection");
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

const frontendResolution = { height: 480, width: 640 };
const backendResolution = { height: 240, width: 320 };

// endpoints
let lastRetrievedImage;
let lastActiveSections;

app.get("/image", function(req, res) {
    if (lastRetrievedImage) {
        res.status(200).send(lastRetrievedImage);
    } else {
        const mat = wCap.read();
        const image = cv.imencode(".jpg", mat);
        // let base64Image = Buffer.from(cv.imencode(".png", mat)).toString();
        const base64Image = new Buffer(image).toString("base64");
        res.status(200).send(base64Image);
    }
});

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

    socket.on("requestImage", () => {
        socket.emit("activeImage", lastRetrievedImage);
    });

    socket.on("requestActiveSections", () => {
        socket.emit("activeSections", lastActiveSections);
    });
});

// motion stuff
// open capture from webcam
const devicePort = 1;
const wCap = new cv.VideoCapture(devicePort);
wCap.set(cv.CAP_PROP_FRAME_WIDTH, backendResolution.width);
wCap.set(cv.CAP_PROP_FRAME_HEIGHT, backendResolution.height);

// let frame1 = wCap.read();
// let frame1 = cv.imread("./image1.png");
// let image1 = cv.imencode(".ppm", frame1);
// cv.imwrite("./image1.png", frame1);

// const sections = [
//     [{ x: 0, y: 0, width: 160, height: 120 }],
//     [{ x: 161, y: 121, width: 159, height: 119 }]
// ];

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
let motionMask;

const fetchActiveSection = () => {
    wCap.readAsync().then(mat => {
        // const cameraImage = cv.imencode(".jpg", mat);
        // const base64CameraImage = new Buffer(cameraImage).toString("base64");
        // lastRetrievedImage = base64CameraImage;

        const hsvFrame = mat.cvtColor(cv.COLOR_BGR2HSV_FULL);

        let maskedMat;
        const hsvMasks = db.getBallMasks();
        hsvMasks.forEach(hsvMask => {
            const min = new cv.Vec3(hsvMask.min[0], hsvMask.min[1], hsvMask.min[2]);
            const max = new cv.Vec3(hsvMask.max[0], hsvMask.max[1], hsvMask.max[2]);
            const rangeMask = hsvFrame.inRange(min, max);
            maskedMat = mat.copyTo(maskedMat || new cv.Mat(), rangeMask);
        });

        const cameraImage = cv.imencode(".jpg", maskedMat);
        const base64CameraImage = new Buffer(cameraImage).toString("base64");
        lastRetrievedImage = base64CameraImage;

        // cv.imshowWait("image", maskedImage);
        motionMask = mog2.apply(maskedMat);

        getActiveSections(db.getSections(), motionMask).then(activeSections => {
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
            console.log(JSON.stringify(lastActiveSections.map(s => s.index)));
            // if (activeSections.some(v => v !== undefined)) {
            //     const section = db.getSection(activeSectionIndex);
            //     const zones = adjustZonesResolution(
            //         section.zones,
            //         backendResolution,
            //         frontendResolution
            //     );
            //     console.log(activeSectionIndex);

            //     lastActiveSection = { index: activeSectionIndex, zones };
            // }
            setTimeout(fetchActiveSection, 5);
        });
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
