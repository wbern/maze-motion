import React from "react";
import { Col, ListGroup, Row, ListGroupItem } from "react-bootstrap";

import "./ColorSelector.css";
import ColorSelectorGroup from "./ColorSelectorGroup";
import FontAwesome from "react-fontawesome";

export class ColorSelector extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            // default colors in color picker
            defaultItem: {
                min: [0, 0, 0],
                max: [0, 0, 0]
            },
            // color ranges items
            items: []
        };

        this.onGroupComplete = this.onGroupComplete.bind(this);
    }

    componentWillReceiveProps(nextProps, nextState) {
        if(!this.props.defaultItems && nextProps.defaultItems) {
            let newDefaultItem = {...nextState.defaultItem};
            if (nextProps.defaultItems.length > 0) {
                // last group was updated, change default colors to last group
                // this won't really affect anything though, because
                // the color picker default color won't reload itself
                newDefaultItem = nextProps.defaultItems.slice(-1)[0];
            }

            this.setState({items: nextProps.defaultItems, defaultItem: newDefaultItem});
        }
    }

    onGroupComplete(index, colorGroup) {
        const newItems = [...this.state.items];
        let newDefaultItem = { ...this.state.defaultItem };
        newItems[index] = colorGroup;

        if (index >= this.state.items.length - 1) {
            // last group was updated, change default colors to last group
            newDefaultItem = colorGroup;
        }

        this.setState({ items: newItems, defaultItem: newDefaultItem });

        if(this.props.onChange) {
            this.props.onChange(newItems);
        }
    }

    onRemoveClick(index) {
        const newItems = [...this.state.items];
        let newDefaultItem = { ...this.state.defaultItem };
        newItems.splice(index, 1);

        if (this.state.items.length > 1 && index >= this.state.items.length - 1) {
            // last group was updated, change default colors to last group
            // this won't really affect anything though, because
            // the color picker default color won't reload itself
            newDefaultItem = this.state.items[index - 1];
        }

        this.setState({ items: newItems, defaultItem: newDefaultItem });

        if(this.props.onChange) {
            this.props.onChange(newItems);
        }
    }

    render() {
        return (
            <Row>
                <h2 className="text-left">{this.props.textLabel}</h2>
                <ListGroup>
                    {this.state.items &&
                        this.state.items.concat(this.state.defaultItem).map((item, index) => {
                            const isLastNotYetCreatedItem = index === this.state.items.length;

                            return (
                                <ListGroupItem key={item.min.toString() + "-" + item.max.toString() + "-" + index}>
                                    <Row
                                        className={
                                            "listGroupItem" +
                                            (isLastNotYetCreatedItem ? " notCreated" : "")
                                        }
                                    >
                                        <Col>
                                            <ColorSelectorGroup
                                                onGroupComplete={colorGroup => {
                                                    this.onGroupComplete(index, colorGroup);
                                                }}
                                                defaultColors={this.state.defaultItem}
                                            />
                                        </Col>
                                        <Col xs={1}>
                                            <FontAwesome
                                                onClick={() => {
                                                    this.onRemoveClick(index);
                                                }}
                                                style={
                                                    isLastNotYetCreatedItem
                                                        ? { visibility: "hidden" }
                                                        : {}
                                                }
                                                name={"times-circle"}
                                            />
                                        </Col>
                                    </Row>
                                </ListGroupItem>
                            );
                        })}
                </ListGroup>
            </Row>
        );
    }
}

export default ColorSelector;
