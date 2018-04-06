import React from "react";

import { Col, Row, Label } from "react-bootstrap";
import ColorSelectorItem from "./ColorSelectorItem";

export class MyComponent extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    render() {
        return (
            <div style={{ display: "flex" }}>
                <Row>
                    <Col xs={6}>
                        <ColorSelectorItem labelText="Min" />
                    </Col>
                    <Col xs={6}>
                        <ColorSelectorItem labelText="Max " />
                    </Col>
                </Row>
            </div>
        );
    }
}

export default MyComponent;
