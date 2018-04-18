import openSocket from "socket.io-client";

import React, { Component } from "react";
import {
    Nav,
    Navbar,
    NavItem,
    Row
} from "react-bootstrap";

import "./App.css";

import Calibrate from "./components/Calibrate";

const enums = {
    VIEW: "VIEW",
    CALIBRATE: "CALIBRATE"
};

class App extends Component {
    constructor(props) {
        super(props);

        this.state = {
            view: enums.CALIBRATE
        };
    }

    componentWillMount() {
        this.socket = openSocket("http://localhost:8080");
    }

    setView(view) {
        this.setState({
            view
        });
    }

    getView() {
        switch (this.state.view) {
            case enums.CALIBRATE:
                return <Calibrate socket={this.socket} />;
            case enums.VIEW:
                return <div>view!!</div>;
            default:
                return <div>default</div>;
        }
    }

    render() {
        return (
            <div className="App">
                <Navbar>
                    <Navbar.Header>
                        <Navbar.Brand>
                            <a onClick={() => this.setView(enums.VIEW)}>Play</a>
                        </Navbar.Brand>
                    </Navbar.Header>
                    <Nav>
                        <NavItem
                            onClick={() => this.setView(enums.CALIBRATE)}
                            eventKey={1}
                            href="#"
                        >
                            Calibrate
                        </NavItem>
                    </Nav>
                </Navbar>
                <Row>
                    <div>{this.getView()}</div>
                </Row>
            </div>
        );
    }
}

export default App;
