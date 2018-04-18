const app = require("express")();
const http = require("http").Server(app);
const server = http.listen(9090, function() {
    console.log("listening on *:9090");
});
const io = require("socket.io").listen(server);
const db = require("./db");

// globals
// let settings = db.getSettings();

const status = {};

// apply settings to etc.
const applySettings = () => {};
applySettings();

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
    disconnect: "disconnect"
};

const serverMsg = {};

// socket endpoints
io.on(clientMsg.connection, function(socket) {
    console.log("a user connected");
    Object.keys(clientMsg).forEach(key => {
        const msg = clientMsg[key];

        socket.on(
            msg,
            function(data) {
                switch (msg) {
                default:
                    break;
                }
            }.bind(this)
        );
    });
});

// track active section from detector backend, notify frontend of changes
const track = () => {
    try {
        status.errorMessage = "";
        setTimeout(track, 1000);
    } catch (e) {
        status.errorMessage = e;
        console.error(e);
        setTimeout(track, 1000);
    }
};
track();
