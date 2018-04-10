import React from "react";
import { Form, Col, InputGroup, FormControl, ControlLabel } from "react-bootstrap";
import ColorPicker from "rc-color-picker";

import convert from "color-convert";

export class ColorSelectorItem extends React.Component {
    constructor(props) {
        super(props);

        this.state = { defaultColorHsv: "#" + convert.hsv.hex(this.props.defaultColor) };

        this.onClose = this.onClose.bind(this);
    }

    onClose(data) {
        const hsv = convert.hex.hsv(data.color);
        this.setState({currentColor: hsv});
        if (this.props.onChange) {
            this.props.onChange(hsv);
        }
    }

    componentWillMount() {
    }

    componentDidMount() {}

    render() {
        return (
            <Form horizontal>
                <Col xs={2} className="text-right">
                    <ControlLabel>{this.props.labelText}</ControlLabel>
                </Col>
                <Col xs={10}>
                    <InputGroup>
                        <InputGroup.Addon style={{ lineHeight: 0 }}>
                            <ColorPicker
                                animation=""
                                enableAlpha={false}
                                mode={"HSB"}
                                defaultColor={this.state.defaultColorHsv}
                                onClose={this.onClose}
                                // onChange={changeHandler}
                            />
                        </InputGroup.Addon>
                        <FormControl disabled type="text" value={(this.state.currentColor || this.props.defaultColor).join(", ")} />
                    </InputGroup>
                </Col>
            </Form>
        );
    }
}

export default ColorSelectorItem;
