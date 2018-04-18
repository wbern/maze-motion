const app = require("express")();
const http = require("http").Server(app);
const server = http.listen(9090, function() {
    console.log("listening on *:9090");
});
const io = require("socket.io").listen(server);
const openSocket = require("socket.io-client");
const db = require("./db");

// globals
// let settings = db.getSettings();

const modes = {
    instructions: "instructions",
    ready: "ready",
    started: "started",
    finish: "finish"
};

const settings = {
    ballMissingSecondsLimit: 3,
    ballSectionChangeAcceptanceLimit: 3
};

let status = {};

const defaultStatus = {
    currentMode: modes.instructions, // enum
    gameStarted: false, // bool
    highestSection: 0, // number
    currentSection: 0, // number
    startTime: null, // date
    endTime: null, // date
    ballMissingDuration: null, // date
    lastSectionNumber: null
};

// resets game status (including mode)
const resetStatus = () => {
    status = Object.assign({}, defaultStatus);
};
resetStatus();

// apply settings to etc.
const applySettings = () => {};
applySettings();

// messages from front-end
const clientMsg = {
    connection: "connection",
    disconnect: "disconnect"
};

// messages going from this application (game-server) to the front-end
const gameServerMsg = {
    mode: "mode"
};

// messages going from this application (game server) to the back-end
const gameClientMsg = {
    connection: "connection",
    disconnect: "disconnect",
    requestActiveSections: "requestActiveSections",
    requestSections: "requestSections"
};

// messages from back-end
const serverMsg = {
    activeSections: "activeSections",
    sections: "sections"
};

// socket endpoints
io.on(clientMsg.connection, function(frontendSocket) {
    // subscribe to client messages
    Object.keys(clientMsg).forEach(key => {
        const msg = clientMsg[key];

        frontendSocket.on(
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

const backendSocket = openSocket("http://localhost:8080");

backendSocket.on(
    gameClientMsg.connection,
    function(socket) {
        // subscribe to backend messages
        Object.keys(clientMsg).forEach(key => {
            const msg = serverMsg[key];

            socket.on(
                msg,
                function(data) {
                    switch (msg) {
                    case serverMsg.activeSections:
                        onActiveSections(data);
                        break;
                    case serverMsg.sections:
                        // get the highest section number and make it available via status object
                        status.lastSectionNumber = Math.max(...Object.keys(data));
                        break;
                    default:
                        break;
                    }
                }.bind(this)
            );
        });

        // request some initial data
        socket.emit(gameClientMsg.requestSections);
    }.bind(this)
);

const switchSection = section => {
    if (section > status.highestSection) {
        // it's a new "high"
        status.highestSection = section;
    }
    status.currentSection = section;
};

const isLegitSectionChange = proposedSection => {
    return (
        Math.abs(status.currentSection - proposedSection) <=
        settings.ballSectionChangeAcceptanceLimit
    );
};

const changeMode = mode => {
    if (mode !== status.currentMode) {
        // new mode is different from old one
        const emitMode = () => io.emit(gameServerMsg.mode, { mode, status });

        switch (mode) {
        case modes.instructions:
        case modes.ready:
            resetStatus(); // to clear any old values
            status.currentMode = mode;
            emitMode();
            break;
        case modes.started:
            status.startTime = new Date();
            status.gameStarted = true;
            status.currentMode = mode;
            emitMode();
            break;
        case modes.finish:
            status.endTime = new Date(Date.now() - (status.ballMissingDuration || 0));
            status.gameStarted = false;
            status.currentMode = mode;
            emitMode();
            break;
        default:
            break;
        }
    }
};

const getClosestSection = (sections, currentSection) => {
    // get section inside sections matching closest with given section number
    // will match optimistically, so if there's an active section behind
    // and ahead of the current section at the same time (which is unlikely),
    // the active second ahead of the current section will be used
    if (sections.length === 1) {
        // only one active section, return it
        return sections[0];
    }

    // return the section number closest
    return parseInt(
        sections[
            sections.reduce((closestArrIndex, x, currentArrIndex) => {
                if (
                    Math.abs(sections[currentArrIndex] - currentSection) <=
                    sections[closestArrIndex]
                ) {
                    return currentArrIndex;
                } else {
                    return closestArrIndex;
                }
            })
        ]
    );
};

const onActiveSections = activeSections => {
    if (activeSections.length === 0) {
        // ball missing
        if (!status.gameStarted) {
            // game is not started
            if (status.currentMode !== modes.instructions && status.currentMode !== modes.finish) {
                // mode is not on "instructions" nor "finish"
                changeMode(modes.instructions);
            }
        } else {
            // game is started, but ball is gone
            if (status.ballMissingDuration === null) {
                // ball just started being gone, set missing duration
                status.ballMissingStartTime = new Date();
            } else {
                // ball's been gone more than once, check if it's gone too long
                const ballMissingSeconds = (Date.now() - status.ballMissingStartTime) / 1000;
                if (ballMissingSeconds > settings.ballMissingSecondsLimit) {
                    // ball has been gone too long, finish game
                    // emit "finish"
                    changeMode(modes.finish);
                }
            }
        }
    } else {
        // ball is present
        // get section closest to current section (respecting both behind and ahead of current)
        let nextSection = getClosestSection(activeSections, status.currentSection);
        if(!isLegitSectionChange(nextSection)) {
            // it's not a legit section change, revert to current section
            nextSection = status.currentSection;
        }

        if (!status.gameStarted) {
            // game is not started yet, and one of the
            if (nextSection === 0) {
                // active sections is the starting area (0)
                changeMode(modes.ready);
            } else if (nextSection !== 0) {
                // active sections does not include starting area (0)
                // and it seems like a legit section change

                // start the game!
                switchSection(nextSection);
                changeMode(modes.started);
            }
        } else {
            // game is started
            if(nextSection === status.highestSection) {
                // we've entered the last and final section. Finish the game.
                switchSection(nextSection);
                changeMode(modes.finish);
            }
        }
    }
};

// track active section from detector backend, notify frontend of changes
const track = () => {
    try {
        backendSocket.emit(gameClientMsg.requestActiveSections);

        status.errorMessage = "";
        setTimeout(track, 1000);
    } catch (e) {
        status.errorMessage = e;
        console.error(e);
        setTimeout(track, 1000);
    }
};
track();
