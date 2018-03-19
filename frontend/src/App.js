import openSocket from "socket.io-client";

import React, { Component } from "react";
import logo from "./logo.svg";
import "./App.css";

import Calibrate from "./components/Calibrate";

const enums = {
    VIEW: "VIEW",
    CALIBRATE: "CALIBRATE"
};

class App extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.socket = openSocket("http://localhost:8080");
        this.socket.on("activeSection", activeSection => {
            this.setState({ activeSection });
        });
    }

    setView(view) {
        this.setState({
            view
        });
    }

    getView() {
        switch (this.state.view) {
            case enums.CALIBRATE:
                return <Calibrate />;
            case enums.VIEW:
                return <div>view</div>;
            default:
                return <div>default</div>;
        }
    }

    render() {
        return (
            <div className="App">
                <h1 className="App-title" onClick={() => this.setView(enums.VIEW)}>
                    Debug
                </h1>
                <h1 className="App-title" onClick={() => this.setView(enums.CALIBRATE)}>
                    Calibrate
                </h1>
                <p className="App-intro">
                    To get started, edit <code>src/App.js</code> and save to reload.
                </p>
                <p>
                    {this.getView()}
                    {this.state.activeSection}
                </p>
            </div>
        );
    }
}

export default App;
