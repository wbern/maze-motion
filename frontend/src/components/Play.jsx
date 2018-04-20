import React from "react";

import Constants from "../Constants";
import openSocket from "socket.io-client";

import Instructions from "./Play/Instructions";
import Ready from "./Play/Ready";
import Started from "./Play/Started";
import Finish from "./Play/Finish";

import "./Play.css";

const modes = {
    instructions: "instructions",
    ready: "ready",
    started: "started",
    finish: "finish"
};

const clientMsg = {
    requestMode: "requestMode"
};

const gameServerMsg = {
    disconnect: "disconnect",
    connect: "connect",
    mode: "mode"
};

// kits colors
// #62A6A3
// #B0AE97
// #F37F4A
// #C1AF49

export class Play extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            backgroundColorIndex: Math.floor(Math.random() * Math.floor(4) + 1),
            status: {}
        };
        // open socket to game server
        this.socket = openSocket(Constants.gameServerAddress);
    }

    componentDidMount() {
        this.backgroundColorInterval = setInterval(
            function() {
                this.setState({ backgroundColorIndex: this.state.backgroundColorIndex % 4 + 1 });
            }.bind(this),
            15000
        );

        this.subscribe();
    }

    componentWillUnmount() {
        clearInterval(this.backgroundColorInterval);

        this.unsubscribe();
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }

    requestInitialData() {
        this.emitIfConnected(clientMsg.requestMode);
    }

    emitIfConnected(...args) {
        if (this.socket && this.socket.connected) {
            this.socket.emit.apply(this.socket, args);
        }
    }

    subscribe() {
        // connection-related
        const setConnected = () => {
            this.setState({ connected: true });
            this.requestInitialData();
        };
        const setDisconnected = () => {
            this.setState({ connected: false });
        };

        if (this.socket.connected) {
            setConnected();
        } else {
            setDisconnected();
        }

        Object.keys(gameServerMsg).forEach(key => {
            const msg = gameServerMsg[key];

            this.socket.on(
                msg,
                function(data) {
                    switch (msg) {
                        case gameServerMsg.connect:
                            setConnected();
                            break;
                        case gameServerMsg.disconnect:
                            setDisconnected();
                            break;
                        case gameServerMsg.mode:
                            this.setState({ status: data.status });
                            break;
                        default:
                            break;
                    }
                }.bind(this)
            );
        });
    }

    unsubscribe() {
        Object.keys(gameServerMsg).forEach(key => {
            const msg = gameServerMsg[key];
            this.socket.off(msg);
        });
    }

    componentWillMount() {}

    getScreenByMode(mode) {
        const propsToPass = { status: this.state.status };

        const getComponent = () => {
            switch (mode) {
                case modes.ready:
                    return Ready;
                case modes.started:
                    return Started;
                case modes.finish:
                    return Finish;
                case modes.instructions:
                    return Instructions;
                default:
                    return Instructions;
            }
        };
        const Component = getComponent();

        return <Component {...propsToPass} />;
    }

    render() {
        return (
            <div
                className={
                    "Play Play-backgroundColor Play-backgroundColor-" + this.state.backgroundColorIndex
                }
            >
                {this.getScreenByMode(this.state.status.currentMode)}
            </div>
        );
    }
}

export default Play;
