import React from "react";

import { Col, Row, Label } from "react-bootstrap";
import ColorSelectorItem from "./ColorSelectorItem";

export class ColorSelectorGroup extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    render() {
        return (
            <div style={{ display: "flex" }}>
                <Row>
                    <Col xs={6}>
                        <ColorSelectorItem onChange={(minHsvColor => this.setState({min: minHsvColor}))} defaultColor={this.props.colors.min} labelText="Min" />
                    </Col>
                    <Col xs={6}>
                        <ColorSelectorItem onChange={(maxHsvColor => this.setState({max: maxHsvColor}))} defaultColor={this.props.colors.max} labelText="Max " />
                    </Col>
                </Row>
            </div>
        );
    }
}

export default ColorSelectorGroup;
