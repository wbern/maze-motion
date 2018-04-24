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
    ballSectionChangeAcceptanceLimit: 4,
    defaultName: "Anonymous",
    nameCharacterLimit: 30,
    badDetectionLimit: 4
};

let status = {};

// resets game status (including mode)
const resetStatus = () => {
    status = Object.assign(
        {},
        // default values
        {
            currentMode: modes.instructions, // enum
            gameStarted: false, // bool
            highestSection: 0, // number
            currentSection: 0, // number
            startTime: null, // date
            endTime: null, // date
            ballMissingStartTime: null, // date
            lastSectionNumber: null,
            waitingForActiveSection: false
        },
        // values that should stick from before status reset
        {
            lastSectionNumber: status.lastSectionNumber,
            currentName: status.currentName || settings.defaultName
        }
    );
};
resetStatus();

// apply settings to etc.
const applySettings = () => {};
applySettings();

// messages from front-end
const clientMsg = {
    connection: "connection",
    disconnect: "disconnect",
    requestSettings: "requestSettings",
    requestMode: "requestMode",
    requestRecords: "requestRecords",
    saveName: "saveName",
    requestFinish: "requestFinish"
};

// messages going from this application (game-server) to the front-end
const gameServerMsg = {
    settings: "settings",
    mode: "mode",
    records: "records",
    badDetection: "badDetection"
};

// messages going from this application (game server) to the back-end
const gameClientMsg = {
    connect: "connect",
    disconnect: "disconnect",
    requestStatus: "requestStatus",
    requestActiveSections: "requestActiveSections",
    requestActiveSectionsNormalizedWithoutZoneData:
        "requestActiveSectionsNormalizedWithoutZoneData",
    requestSections: "requestSections"
};

// messages from back-end
const serverMsg = {
    status: "status",
    activeSections: "activeSections",
    sections: "sections",
    activeSectionsNormalizedWithoutZoneData: "activeSectionsNormalizedWithoutZoneData"
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
                case clientMsg.requestMode:
                    emitCurrentModeAndStatus();
                    break;
                case clientMsg.requestRecords:
                    frontendSocket.emit(gameServerMsg.records, db.getRecords());
                    break;
                case clientMsg.requestFinish:
                    if (status.currentMode === modes.started) {
                        changeMode(modes.finish);
                    } else if (status.currentMode === modes.ready) {
                        changeMode(modes.instructions);
                    }
                    break;
                case clientMsg.requestSettings:
                    frontendSocket.emit(gameServerMsg.settings, settings);
                    break;
                case clientMsg.saveName:
                    if (!data) {
                        data = settings.defaultName;
                    }

                    status.currentName =
                            data.length > settings.nameCharacterLimit
                                ? "Mr. \"I just learned how to hack\""
                                : data;
                    break;
                default:
                    break;
                }
            }.bind(this)
        );
    });
});

const backendSocket = openSocket("http://localhost:8080");

backendSocket.on(
    gameClientMsg.connect,
    function() {
        // subscribe to backend messages
        Object.keys(serverMsg).forEach(key => {
            const msg = serverMsg[key];

            backendSocket.on(
                msg,
                function(data) {
                    switch (msg) {
                    case serverMsg.activeSectionsNormalizedWithoutZoneData:
                        onActiveSections(data);
                        status.waitingForActiveSection = false;
                        break;
                    case serverMsg.sections:
                        // get the highest section number and make it available via status object
                        status.lastSectionNumber = Math.max(...Object.keys(data));
                        emitCurrentModeAndStatus();
                        break;
                    case serverMsg.status:
                        if (data.timings.corners < settings.badDetectionLimit) {
                            io.emit(gameServerMsg.badDetection);
                        } else if (data.timings.error > 0) {
                            io.emit(gameServerMsg.badDetection);
                        } else if (data.timings.general < settings.badDetectionLimit) {
                            io.emit(gameServerMsg.badDetection);
                        }
                        break;
                    default:
                        break;
                    }
                }.bind(this)
            );
        });

        // request some initial data
        backendSocket.emit(gameClientMsg.requestSections);
    }.bind(this)
);

const switchSection = section => {
    const newHighest = section > status.highestSection;
    if (newHighest) {
        // it's a new "high"
        status.highestSection = section;
    }

    if (status.currentSection !== section) {
        console.log(
            "Current Section: " +
                status.currentSection +
                " -> " +
                section +
                (newHighest ? " (New highest)" : "")
        );
        status.currentSection = section;
    }

    // broadcast the change
    emitCurrentModeAndStatus();
};

const isLegitSectionChange = proposedSection => {
    return (
        Math.abs(status.currentSection - proposedSection) <=
        settings.ballSectionChangeAcceptanceLimit
    );
};

const emitCurrentModeAndStatus = optionalNewMode => {
    if (optionalNewMode) {
        status.currentMode = optionalNewMode;
    }

    io.emit(gameServerMsg.mode, {
        mode: status.currentMode,
        status
    });
};

const changeMode = mode => {
    if (mode !== status.currentMode) {
        // new mode is different from old one
        console.log("Mode: " + status.currentMode + " -> " + mode);

        switch (mode) {
        case modes.instructions:
            emitCurrentModeAndStatus(mode);
            break;
        case modes.ready:
            resetStatus(); // to clear any old values
            emitCurrentModeAndStatus(mode);
            break;
        case modes.started:
            resetStatus(); // to clear any old values
            status.startTime = new Date();
            status.gameStarted = true;
            emitCurrentModeAndStatus(mode);
            break;
        case modes.finish:
            // set end time based on when the ball first went missing
            status.endTime = status.ballMissingStartTime || new Date();
            status.gameStarted = false;
            status.currentMode = mode;

            // record the score
            const id = db.addRecord(
                status.highestSection,
                status.endTime - status.startTime,
                status.currentName || "Anonymous",
                status.startTime
            );
            const records = db.getRecords();
            status.rank = records.findIndex(r => r.id === id) + 1;
            status.id = id;
            io.emit(gameServerMsg.records, records.slice(0, 100));

            emitCurrentModeAndStatus(mode);
            break;
        default:
            break;
        }
    }
};

const emitToBackendIfConnected = (...args) => {
    if (backendSocket && backendSocket.connected) {
        backendSocket.emit.apply(backendSocket, args);
    }
};

const getClosestSection = (sections, currentSection) => {
    // get section inside sections matching closest with given section number
    // will match optimistically, so if there's an active section behind
    // and ahead of the current section at the same time (which is unlikely),
    // the active second ahead of the current section will be used
    if (sections.length === 0) {
        throw new Error("No sections to determine closest section from");
    } else if (sections.length === 1) {
        // only one active section, return it
        return parseInt(sections[0]);
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

const onBallMissing = () => {
    if (status.ballMissingStartTime === null) {
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
};

const onActiveSections = activeSections => {
    if (activeSections.length > 0) {
        // ball is present
        // reset missing timer if it was set
        status.ballMissingStartTime = null;

        // get section closest to current section (respecting both behind and ahead of current)
        const nextSection = getClosestSection(activeSections, status.currentSection);
        const isLegit = isLegitSectionChange(nextSection);

        if (status.gameStarted) {
            // game is started, and we've ..
            if (nextSection === status.lastSectionNumber && isLegit) {
                // entered the last and final section and its legit. Finish the game.
                switchSection(nextSection);
                changeMode(modes.finish);
            } else if (isLegit) {
                // advanced or gone back since last active section
                switchSection(nextSection);
            } else {
                // ball is not in a legit position, mark it as missing
                onBallMissing();
            }
        } else {
            // game is not started yet, and one of the ..
            if (nextSection === 0) {
                // active sections is the starting area (0)
                changeMode(modes.ready);
            } else if (status.currentMode === modes.ready && nextSection !== 0 && isLegit) {
                // game mode was previously "ready"
                // active sections does not include starting area (0)
                // and it seems like a legit section change

                // start the game first, then increment the section!
                changeMode(modes.started);
                switchSection(nextSection);
            } else if (nextSection !== 0 && !isLegit) {
                // ball is misplaced, send instructions
                changeMode(modes.instructions);
            }
        }
    } else {
        // ball missing
        if (status.gameStarted) {
            // game is started, but ball is gone
            onBallMissing();
        } else {
            // game is not started
            if (status.currentMode !== modes.instructions && status.currentMode !== modes.finish) {
                // mode is not on "instructions" nor "finish"
                if (status.currentMode !== modes.ready) {
                    // we're not in ready-mode, send instructions
                    // (this condition is somewhat of a work-around)
                    changeMode(modes.instructions);
                }
            }
        }
    }
};

// track active section from detector backend, notify frontend of changes
let statusSkips = 0;
const statusMaxSkips = 20;

const track = () => {
    try {
        if (!status.waitingForActiveSection || statusSkips >= statusMaxSkips) {
            emitToBackendIfConnected(gameClientMsg.requestActiveSectionsNormalizedWithoutZoneData);

            if (backendSocket && backendSocket.connected) {
                status.waitingForActiveSection = true;
            }

            status.errorMessage = "";
        }

        if (statusSkips < statusMaxSkips) {
            statusSkips++;
        } else {
            statusSkips = 0;
            emitToBackendIfConnected(gameClientMsg.requestStatus);
        }

        setTimeout(track, 25);
    } catch (e) {
        status.errorMessage = e;
        console.error(e);
        setTimeout(track, 1000);
    }
};
track();
