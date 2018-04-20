import React from "react";
import "./Finish.css";

import { getTimeText } from "../Play.functions";

export class Finish extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    render() {
        return (
            <div className="Finish">
                <p>{this.props.status.lastSectionNumber === this.props.status.highestSection ? "Goal!" : "Game Over!"}</p>
                <p>Your time: {getTimeText(this.props.status.startTime)}</p>
                <p>Lost in section: {this.props.status.currentSection}</p>
                <p>Highest section reached: {this.props.status.highestSection}</p>
                {/* <p>{JSON.stringify(this.props.status)}</p> */}
            </div>
        );
    }
}

export default Finish