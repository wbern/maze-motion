import React from "react";
import { ListGroup, Row, ListGroupItem } from "react-bootstrap";

import ColorSelectorGroup from "./ColorSelectorGroup";

export class ColorSelector extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    render() {
        return (
            <Row>
                <h2 className="text-left">{this.props.textLabel}</h2>
                <ListGroup>
                    <ListGroupItem>
                        <ColorSelectorGroup />
                    </ListGroupItem>
                </ListGroup>
            </Row>
        );
    }
}

export default ColorSelector;
