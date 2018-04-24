import React from "react";

import {
    FormControl,
    Form,
} from "react-bootstrap";

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
    requestMode: "requestMode",
    requestSettings: "requestSettings",
    requestRecords: "requestRecords",
    saveName: "saveName"
};

const gameServerMsg = {
    disconnect: "disconnect",
    connect: "connect",
    settings: "settings",
    mode: "mode",
    records: "records"
};

export class Play extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            settings: {
                // default values
                nameCharacterLimit: 30,
                defaultName: ""
            },
            currentName: null,
            backgroundColorIndex: Math.floor(Math.random() * Math.floor(4) + 1),
            status: {}
        };
        // open socket to game server
        this.socket = openSocket(Constants.gameServerAddress);

        this.onNameBlur = this.onNameBlur.bind(this);
        this.onNameChange = this.onNameChange.bind(this);
        this.getInputRef = this.getInputRef.bind(this);
        this.onSubmit = this.onSubmit.bind(this);
    }

    componentDidMount() {
        // this.backgroundColorInterval = setInterval(
        //     function() {
        //         this.setState({ backgroundColorIndex: this.state.backgroundColorIndex % 4 + 1 });
        //     }.bind(this),
        //     15000
        // );

        this.subscribe();
    }

    componentWillUpdate(nextProps, nextState) {
        if (
            this.state.status &&
            nextState.status &&
            nextState.status.currentMode !== this.state.status.currentMode
        ) {
            // new mode, change background
            this.setState({ backgroundColorIndex: this.state.backgroundColorIndex % 4 + 1 });
        }
    }

    componentWillUnmount() {
        // clearInterval(this.backgroundColorInterval);

        this.unsubscribe();
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }

    requestInitialData() {
        this.emitIfConnected(clientMsg.requestMode);
        this.emitIfConnected(clientMsg.requestRecords);
        this.emitIfConnected(clientMsg.requestSettings);
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
                        case gameServerMsg.records:
                            this.setState({ records: data });
                            break;
                        case gameServerMsg.settings:
                            this.setState({ settings: data });
                            if (this.state.currentName === null) {
                                this.setState({ currentName: data.defaultName });
                            }
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

    updateName(text, replaceEmpty = false) {
        if (replaceEmpty && text === "") {
            text = this.state.defaultName;
        }
        const finalName = text.substr(0, this.state.nameCharacterLimit);

        if (finalName !== this.state.currentName) {
            this.setState({
                currentName: text.substr(0, this.state.nameCharacterLimit)
            });
            this.emitIfConnected(clientMsg.saveName, finalName);
        }
    }

    onNameChange(e) {
        this.updateName(e.target.value);
    }

    onNameBlur(e) {
        this.updateName(e.target.value, true);
    }

    onSubmit(e) {
        e.preventDefault();
        this.updateName(this.state.currentName, true);
    }

    getInputRef(submit) {
        // this.inputElement = submit;
    }

    componentDidUpdate() {
        const input = document.querySelector(".Play-input");

        if (input && document.activeElement !== input) {
            const length = input.value.length;
            input.focus();
            input.setSelectionRange(length, length);
        }
    }

    getScreenByMode(mode) {
        const propsToPass = { status: this.state.status, records: this.state.records };

        const getComponent = () => {
            switch (mode) {
                case modes.ready:
                    return Ready;
                case modes.started:
                    return Started;
                case modes.finish:
                    return Finish;
                case modes.instructions:
                    return Finish;
                default:
                    return Finish;
            }
        };
        const Component = getComponent();

        return (
            <Component {...propsToPass}>
                <span className="Play-inputWrapper">
                    <Form inline onSubmit={this.onSubmit}>
                        <FormControl
                            style={{
                                width:
                                    Math.max((this.state.currentName || "").length * 0.65, 5) + "em"
                            }}
                            onChange={this.onNameChange}
                            onBlur={this.onNameBlur}
                            // onClick={(e) => e.target.select()}
                            disabled={this.state.currentName === null}
                            value={this.state.currentName}
                            className="Play-input"
                            type="text"
                        />
                    </Form>
                </span>
            </Component>
        );
    }

    render() {
        return [
            <div
                key="background"
                className={
                    "Play-backgroundColor Play-backgroundColor-" + this.state.backgroundColorIndex
                }
            />,
            <div key="foreground" className="Play">
                {this.getScreenByMode(this.state.status.currentMode)}
            </div>
        ];
    }
}

export default Play;
