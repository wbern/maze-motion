const cv = require("opencv4nodejs");
// const path = require("path");
const getActiveSection = require("./lib/getActiveSection");
const simplifyZones = require("./lib/simplifyZones");

var app = require("express")();
var http = require("http").Server(app);
var server = http.listen(8080, function() {
    console.log("listening on *:8080");
});
var io = require("socket.io").listen(server);
var db = require("./db");

// endpoints
let lastRetrievedImage;
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
        data.zones = simplifyZones(data.zones);
        db.writeSection(data.index, data.zones);
    });

    socket.on("loadSection", index => {
        console.log("loadSection");
        const result = db.getSection(index);
        socket.emit("loadedSection", Object.assign({ index }, result));
    });
});

// motion stuff
// open capture from webcam
const devicePort = 0;
const wCap = new cv.VideoCapture(devicePort);
wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320);
wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240);

// let frame1 = wCap.read();
// let frame1 = cv.imread("./image1.png");
// let image1 = cv.imencode(".ppm", frame1);
// cv.imwrite("./image1.png", frame1);

// const sections = [
//     [{ x: 0, y: 0, width: 160, height: 120 }],
//     [{ x: 161, y: 121, width: 159, height: 119 }]
// ];

const mog2 = new cv.BackgroundSubtractorMOG2();
let mask;

const fetchActiveSection = () => {
    wCap.readAsync().then(mat => {
        const cameraImage = cv.imencode(".jpg", mat);
        const base64CameraImage = new Buffer(cameraImage).toString("base64");
        lastRetrievedImage = base64CameraImage;

        mask = mog2.apply(mat);
        const maskImage = cv.imencode(".jpg", mask);
        const base64MaskImage = new Buffer(maskImage).toString("base64");

        getActiveSection(db.getSections(), mask).then(activeSectionIndex => {
            // only emit something if there's a change
            if (activeSectionIndex !== null) {
                const zones = db.getSection(activeSectionIndex);
                console.log(activeSectionIndex);

                // repeat
                io.emit("activeMask", base64MaskImage);
                io.emit("activeImage", base64CameraImage);
                io.emit("activeSection", Object.assign({ index: activeSectionIndex }, zones));
            }
            setTimeout(fetchActiveSection, 3000);
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
