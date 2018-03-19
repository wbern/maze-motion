const cv = require("opencv4nodejs");
const path = require("path");
const getActiveSection = require("./lib/getActiveSection");

var app = require("express")();
var http = require("http").Server(app);
var server = http.listen(8080, function() {
    console.log("listening on *:8080");
});
var io = require("socket.io").listen(server);

io.on("connection", function(socket) {
    console.log("a user connected");
});

app.get("/image", function(req, res) {
    let mat = wCap.read();
    let image = cv.imencode(".jpg", mat);
    // let base64Image = Buffer.from(cv.imencode(".png", mat)).toString();
    let base64Image = new Buffer(image).toString("base64");
    res.status(200).send(base64Image);
});

// open capture from webcam
const devicePort = 0;
const wCap = new cv.VideoCapture(devicePort);
wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320);
wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240);

// // let frame1 = wCap.read();
// let frame1 = cv.imread("./image1.png");
// frame1.cvtColor(cv.COLOR_BGR2GRAY);
// // let image1 = cv.imencode(".ppm", frame1);
// // cv.imwrite("./image1.png", frame1);

// let frame2 = cv.imread("./image2.png");
// // frame1.cvtColor(cv.COLOR_BGR2GRAY);
// // let image2 = cv.imencode(".ppm", frame2);
// // cv.imwrite("./image2.png", frame1);

// // works but crude
// // let diff = frame2.absdiff(frame1);
// // cv.imwrite("./image_diff.png", diff);

const sections = [
    { x: 0, y: 0, width: 160, height: 120 },
    { x: 161, y: 121, width: 159, height: 119 }
];

let mog2 = new cv.BackgroundSubtractorMOG2();
let mask;

const fetchActiveSection = () => {
    wCap.readAsync().then(mat => {
        mask = mog2.apply(mat);

        let activeSection = getActiveSection(sections, mask);
        console.log(activeSection);

        // repeat
        io.emit("activeSection", activeSection);
        setTimeout(fetchActiveSection, 4000);
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
