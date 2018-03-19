const cv = require("opencv4nodejs");
const path = require("path");
const getActiveSection = require("./lib/getActiveSection");

var app = require("express")();
var http = require("http").Server(app);
var server = http.listen(8080, function() {
    console.log("listening on *:8080");
});
var io = require("socket.io").listen(server);

// endpoints
app.get("/image", function(req, res) {
    let mat = wCap.read();
    let image = cv.imencode(".jpg", mat);
    // let base64Image = Buffer.from(cv.imencode(".png", mat)).toString();
    let base64Image = new Buffer(image).toString("base64");
    res.status(200).send(base64Image);
});

// db stuff
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const adapter = new FileSync("db.json");
const db = low(adapter);

// Set some defaults (required if your JSON file is empty)
db.defaults({ sections: [], users: {}, playcounts: 0 }).write();

// Add a post
// db
//     .get("sections")
// .push({ id: 1, title: "lowdb is awesome" })
// .write();

// Set a user using Lodash shorthand syntax
// db.set("user.name", "typicode").write();

// Increment count
// db.update("count", n => n + 1).write();

io.on("connection", function(socket) {
    console.log("a user connected");
    socket.on("saveSection", data => {
        // webpage wants to save section data
        db
            .get("sections")
            .nth(data.index)
            .assign(data.section)
            .write();
    });

    socket.on("loadSection", index => {
        console.log("loadSection");
        const section = db
            .get("sections")
            .nth(index)
            .value();

        socket.emit("loadedSection", { section, index });
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

const sections = [
    [{ x: 0, y: 0, width: 160, height: 120 }],
    [{ x: 161, y: 121, width: 159, height: 119 }]
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
        setTimeout(fetchActiveSection, 10000);
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
