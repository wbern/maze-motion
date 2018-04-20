import React from "react";
import openSocket from "socket.io-client";

import Constants from "../Constants";

import "./GameSettings.css";

const clientMsg = {};

const gameServerMsg = {
    disconnect: "disconnect",
    connect: "connect",
    mode: "mode"
};

export class GameSettings extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.socket = openSocket(Constants.gameServerAddress);
    }

    componentDidMount() {
        this.subscribe();
    }

    componentWillUnmount() {
        this.unsubscribe();
        this.socket.removeAllListeners();
        this.socket.disconnect();
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
                            this.setState({ status: data });
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

    render() {
        return <div className="GameSettings" />;
    }
}

export default GameSettings;
