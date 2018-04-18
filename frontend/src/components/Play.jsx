import React from "react";
import openSocket from "socket.io-client";

const clientMsg = {};

const serverMsg = {
    disconnect: "disconnect",
    connect: "connect"
};

export class Play extends React.Component {
    constructor(props) {
        super(props);
        // open socket to game server
        this.socket = openSocket("http://localhost:9090");
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

        Object.keys(serverMsg).forEach(key => {
            const msg = serverMsg[key];

            this.socket.on(
                msg,
                function(data) {
                    switch (msg) {
                        case serverMsg.connect:
                            setConnected();
                            break;
                        case serverMsg.disconnect:
                            setDisconnected();
                            break;
                        default:
                            break;
                    }
                }
            );
        });
    }

    unsubscribe() {
        Object.keys(serverMsg).forEach(key => {
            const msg = serverMsg[key];
            this.socket.off(msg);
        });
    }

    componentWillMount() {}

    componentDidMount() {
        this.subscribe();
    }

    render() {
        return <div>let's play</div>;
    }
}

export default Play;
