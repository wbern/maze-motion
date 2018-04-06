import React from "react";
import { Panel, Form, FormGroup, Col, FormControl, ControlLabel } from "react-bootstrap";

export class CameraSettings extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    render() {
        return (
            <Panel>
                <Panel.Heading>
                    <Panel.Title componentClass="h3">Camera Settings</Panel.Title>
                </Panel.Heading>
                <Panel.Body>
                    <Form componentClass="fieldset" horizontal disabled>
                        <FormGroup>
                            <Col componentClass={ControlLabel} xs={4}>
                                Brightness
                            </Col>
                            <Col xs={7}>
                                <FormControl type="number" />
                            </Col>
                        </FormGroup>
                        <FormGroup>
                            <Col componentClass={ControlLabel} xs={4}>
                                Contrast
                            </Col>
                            <Col xs={7}>
                                <FormControl type="number" />
                            </Col>
                        </FormGroup>
                        <FormGroup>
                            <Col componentClass={ControlLabel} xs={4}>
                                Saturation
                            </Col>
                            <Col xs={7}>
                                <FormControl type="number" />
                            </Col>
                        </FormGroup>
                        <FormGroup>
                            <Col componentClass={ControlLabel} xs={4}>
                                Resolution
                            </Col>
                            <Col xs={7}>
                                <FormControl componentClass="select" placeholder="select">
                                    <option value="240">240p</option>
                                    <option value="480">480p</option>
                                    <option value="720">720p</option>
                                </FormControl>
                            </Col>
                        </FormGroup>
                    </Form>
                </Panel.Body>
            </Panel>
        );
    }
}

export default CameraSettings;
