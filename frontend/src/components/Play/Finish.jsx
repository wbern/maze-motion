import React from "react";
import "./Finish.css";

import { getTimeText } from "../Play.functions";

export class Finish extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    getFinishInformation() {
        const beatTheGame = this.props.status.lastSectionNumber === this.props.status.highestSection;

        if(beatTheGame) {
            return <div>
                <p>You beat the game!</p>
                <p>Your time: {getTimeText(this.props.status.startTime, this.props.status.endTime)}</p>
            </div>
        } else {
            return <div>
                <p>Game Over</p>
                <p>Your time: {getTimeText(this.props.status.startTime, this.props.status.endTime)}</p>
                {this.props.status.currentSection !== this.props.status.highestSection && <p>Fell in section: {this.props.status.currentSection}</p>}
                <p>Section: {this.props.status.highestSection}</p>
            </div>
        }
    }

    render() {
        return (
            <div className="Finish">
                {this.getFinishInformation()}
            </div>
        );
    }
}

export default Finish