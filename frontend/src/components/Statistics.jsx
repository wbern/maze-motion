import React from "react";
import FontAwesome from "react-fontawesome";
import { Row, Panel, Form, FormGroup, Col, FormControl, ControlLabel } from "react-bootstrap";

export class Statistics extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    getCornerStatusIcon(cornerStatus) {
        switch (cornerStatus) {
            case "ok":
                return "check-circle";
            case "warn":
                return "exclamation-triangle";
            case "err":
                return "times-circle";
            default:
                return "times-circle";
        }
    }

    render() {
        return (
            <Panel>
                <Panel.Heading>
                    <Panel.Title componentClass="h3">Statistics</Panel.Title>
                </Panel.Heading>
                <Panel.Body>
                    <Row>
                        <Col className="text-right" componentClass={ControlLabel} xs={4}>
                            Active sections
                        </Col>
                        <Col xs={8} className="text-left">
                            {this.props.activeSections && this.props.activeSections.length > 0
                                ? JSON.stringify(this.props.activeSections.map(s => s.index))
                                : " None"}
                        </Col>
                    </Row>
                    <Row>
                        <Col className="text-right" componentClass={ControlLabel} xs={4}>
                            Connected
                        </Col>
                        <Col xs={8} className="text-left">
                            <FontAwesome
                                name={
                                    this.props && this.props.connected
                                        ? "check-circle"
                                        : "times-circle"
                                }
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col className="text-right" componentClass={ControlLabel} xs={4}>
                            Corners
                        </Col>
                        <Col xs={8} className="text-left">
                            <FontAwesome
                                name={
                                    this.getCornerStatusIcon(this.props.cornerStatus)
                                }
                            />
                        </Col>
                    </Row>
                </Panel.Body>
            </Panel>
        );
    }
}

export default Statistics;
