import React from "react";

import { Col, Row, Label } from "react-bootstrap";
import ColorSelectorItem from "./ColorSelectorItem";

export class ColorSelectorGroup extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            // default min and max
            ...this.props.defaultColors
        };
    }

    componentWillMount() {}

    componentDidMount() {}

    isSameColor(currentColor, nextColor) {
        if (!this.isColorValid(currentColor) || !this.isColorValid(nextColor)) {
            throw new Error("One or more invalid color groups");
        }

        return currentColor.toString() === nextColor.toString();
    }

    areColorGroupsIdentical(min1, max1, min2, max2) {
        return this.isSameColor(min1, min2) && this.isSameColor(max1, max2);
    }

    isColorGroupValid(min, max) {
        return this.isColorValid(min) && this.isColorValid(max);
    }

    isColorValid(color) {
        return Array.isArray(color);
    }

    componentWillUpdate(nextProps, nextState) {
        if (
            this.isColorGroupValid(nextState.min, nextState.max) &&
            this.props.onGroupComplete &&
            (!this.isColorGroupValid(this.state.min, this.state.max) ||
                !this.areColorGroupsIdentical(
                    this.state.min,
                    this.state.max,
                    nextState.min,
                    nextState.max
                ))
        ) {
            // new color group recognized
            this.props.onGroupComplete({ min: nextState.min, max: nextState.max });
        }
    }

    render() {
        return (
            <div style={{ display: "flex" }}>
                <Row>
                    <Col xs={6}>
                        <ColorSelectorItem
                            onChange={minHsvColor => this.setState({ min: minHsvColor })}
                            defaultColor={this.props.defaultColors.min}
                            labelText="Min"
                        />
                    </Col>
                    <Col xs={6}>
                        <ColorSelectorItem
                            onChange={maxHsvColor => this.setState({ max: maxHsvColor })}
                            defaultColor={this.props.defaultColors.max}
                            labelText="Max "
                        />
                    </Col>
                </Row>
            </div>
        );
    }
}

export default ColorSelectorGroup;
