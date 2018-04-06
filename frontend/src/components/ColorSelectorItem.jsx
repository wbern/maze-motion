import React from "react";
import { Form, Col, InputGroup, FormControl, ControlLabel } from "react-bootstrap";
import ColorPicker from "rc-color-picker";

export class ColorSelectorItem extends React.Component {
    componentWillMount() {}

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
                                animation="slide-up"
                                enableAlpha={false}
                                mode={"HSB"}
                                color={"#000"}
                                // onChange={changeHandler}
                            />
                        </InputGroup.Addon>
                        <FormControl disabled type="text" />
                    </InputGroup>
                </Col>
            </Form>
        );
    }
}

export default ColorSelectorItem;
