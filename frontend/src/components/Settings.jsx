import React from "react";
import { Panel, Form, FormGroup, Col, Button } from "react-bootstrap";

import { JsonEditor as Editor } from "jsoneditor-react";
import "jsoneditor-react/es/editor.min.css";
import Ajv from "ajv";

import "./Settings.css";

const ajv = new Ajv({ allErrors: true, verbose: true });

export class Settings extends React.Component {
    shouldComponentUpdate(nextProps) {
        // if we re-render while an input is in focus in the editor
        // the cursor gets moved all the way to the left. it's annoying.
        const relevantChangesMade =
            this.props.connected !== nextProps.connected ||
            this.props.settingsLastRetrieved !== nextProps.settingsLastRetrieved;

        // it's also annoying that the options tree gets collapsed when you save a value
        // so don't renew the component if the new settings are exactly like the existing one
        let stillSameSettings;
        if (relevantChangesMade) {
            stillSameSettings =
                JSON.stringify(this.props.settings) === JSON.stringify(nextProps.settings);
        }

        return relevantChangesMade && !stillSameSettings;
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
                            <Col xs={12} className="editorContainer">
                                {[
                                    <Editor
                                        key={this.props.settingsLastRetrieved || 0}
                                        mode="form"
                                        value={this.props.settings}
                                        schema={this.props.settings && this.props.settings._schema}
                                        ajv={ajv}
                                        onChange={this.props.onSettingsChange}
                                    />
                                ]}
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
