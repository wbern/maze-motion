import React from "react";
import {
    Panel,
    Form,
    FormGroup,
    Row,
    Col,
    FormControl,
    Button,
    ControlLabel
} from "react-bootstrap";

export class Settings extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            settingsText: ""
        };
    }

    componentWillMount() {}

    componentDidMount() {}

    shouldComponentUpdate(nextProps) {
        return nextProps.stringifiedSettings !== this.props.stringifiedSettings;
    }

    render() {
        return (
            <Panel>
                <Panel.Heading>
                    <Panel.Title componentClass="h3">Settings</Panel.Title>
                </Panel.Heading>
                <Panel.Body>
                    <Form horizontal onSubmit={e => e.preventDefault()}>
                        <FormGroup>
                            <Col xs={12}>
                                <FormControl
                                    componentClass="textarea"
                                    onChange={e => {
                                        try {
                                            const json = JSON.parse(e.target.value);
                                            this.props.onSettingsChange(e.target.value);
                                        } catch (e) {}
                                    }}
                                    value={this.props.stringifiedSettings}
                                />
                            </Col>
                        </FormGroup>
                        <FormGroup>
                            <Col xs={6}>
                                <Button
                                    onClick={this.props.saveClick}
                                    block
                                    disabled={!this.props.connected}
                                >
                                    Save
                                </Button>
                            </Col>
                            <Col xs={6}>
                                <Button
                                    block
                                    onClick={this.props.loadClick}
                                    disabled={!this.props.connected}
                                >
                                    Load
                                </Button>
                            </Col>
                        </FormGroup>
                    </Form>
                </Panel.Body>
            </Panel>
        );
    }
}

export default Settings;
