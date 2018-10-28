import React, { Component } from "react";
import { Nav, Navbar, NavItem, Row } from "react-bootstrap";

import "./App.css";

import Calibrate from "./components/Calibrate";
import Play from "./components/Play";

const enums = {
    VIEW: "VIEW",
    CALIBRATE: "CALIBRATE"
};

class App extends Component {
    constructor(props) {
        super(props);

        this.state = {
            view: enums.VIEW,
            hideNavBar: true
        };
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
                return <Play />;
            default:
                return <div>?</div>;
        }
    }

    render() {
        return (
            <div className="App">
                {this.state.hideNavBar ? (
                    <div onClick={() => this.setState({ hideNavBar: false})} className="App-showNavbarButton">Show</div>
                ) : (
                    <Navbar className="App-navBar">
                        <Navbar.Header>
                            <Navbar.Brand>
                                <a
                                    onClick={e => {
                                        e.preventDefault();
                                        this.setView(enums.VIEW);
                                    }}
                                    href=""
                                >
                                    Play
                                </a>
                            </Navbar.Brand>
                        </Navbar.Header>
                        <Nav>
                            <NavItem
                                onClick={() => this.setView(enums.CALIBRATE)}
                                eventKey={1}
                                href=""
                            >
                                Calibrate
                            </NavItem>
                        </Nav>
                        <Nav pullRight>
                            <NavItem
                                onClick={() => this.setState({ hideNavBar: true })}
                                eventKey={2}
                                href=""
                            >
                                Hide
                            </NavItem>
                        </Nav>
                    </Navbar>
                )}
                <Row className="App-content">
                    {this.getView()}
                </Row>
            </div>
        );
    }
}

export default App;
