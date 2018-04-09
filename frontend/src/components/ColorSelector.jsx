import React from "react";
import { ListGroup, Row, ListGroupItem } from "react-bootstrap";

import ColorSelectorGroup from "./ColorSelectorGroup";

export class ColorSelector extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            items: [
                {
                    min: [0, 1, 2],
                    max: [3, 4, 5]
                },
                {
                    min: [0, 1, 2],
                    max: [3, 4, 5]
                }
            ]
        };
    }

    componentWillMount() {
    }

    componentDidMount() {}

    render() {
        return (
            <Row>
                <h2 className="text-left">{this.props.textLabel}</h2>
                <ListGroup>
                    {this.state.items &&
                        this.state.items.map((item, index) => {
                            return (
                                <ListGroupItem>
                                    <ColorSelectorGroup colors={item} />
                                </ListGroupItem>
                            );
                        })}
                </ListGroup>
            </Row>
        );
    }
}

export default ColorSelector;
