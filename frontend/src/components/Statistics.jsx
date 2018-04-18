import React from "react";
import FontAwesome from "react-fontawesome";
import { Row, Panel, Col, ControlLabel } from "react-bootstrap";

export class Statistics extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    getCornerStatusIcon(cornerStatus) {
        switch (cornerStatus) {
            case "ok":
                return "check-circle";
            case "warn":
                return "exclamation-triangle";
            case "err":
                return "times-circle";
            default:
                return "times-circle";
        }
    }

    renderItem(header, text, level = 0) {
        return (
            <Row key={header + level}>
                <Col
                    className="text-right"
                    componentClass={ControlLabel}
                    xs={6}
                    style={{ fontWeight: level > 1 ? "normal" : "bold", opacity: 1 - level * 0.3 }}
                >
                    {header}
                </Col>
                <Col className="text-left">{text}</Col>
            </Row>
        );
    }

    getOkErrWarnValue(text) {
        switch (text) {
            case true:
            case "ok":
                return "check-circle";
            case "warn":
                return "exclamation-triangle";
            case "err":
            case false:
                return "times-circle";
            default:
                return "";
        }
    }

    renderItemContents(name, item, level = 0) {
        if (item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length > 0) {
            // item has sub-properties
            return [
                name ? this.renderItem(name, "", level) : null,
                Object.keys(item).map(key => this.renderItemContents(key, item[key], level + 1))
            ];
        } else {
            const okErrWarnValue = this.getOkErrWarnValue(item);
            let textToRender;

            if (okErrWarnValue) {
                textToRender = <FontAwesome name={okErrWarnValue} />;
            } else {
                textToRender = JSON.stringify(item);
            }

            return this.renderItem(name, textToRender, level);
        }
    }

    render() {
        return (
            <Panel>
                <Panel.Heading>
                    <Panel.Title componentClass="h3">Statistics</Panel.Title>
                </Panel.Heading>
                <Panel.Body>
                    {this.props.status && this.renderItemContents("", this.props.status)}
                </Panel.Body>
            </Panel>
        );
    }
}

export default Statistics;
