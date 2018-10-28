import React from "react";
import "./Started.css";

import { getTimeText } from "../Play.functions";

export class Started extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            // temporary
            // status: {
            //     currentMode: "started", // enum
            //     gameStarted: true, // bool
            //     highestSection: 4, // number
            //     currentSection: 7, // number
            //     startTime: new Date(), // date
            //     endTime: null, // date
            //     ballMissingDuration: null, // date
            //     lastSectionNumber: null
            // }
        };
    }

    componentWillMount() {
        this.stopWatchInterval = setInterval(
            function() {
                this.updateTimerRef();
            }.bind(this),
            10
        );
    }

    componentWillUnmount() {
        clearInterval(this.stopWatchInterval);
    }

    updateTimerRef() {
        if (this.timerElement) {
            this.timerElement.innerHTML = getTimeText(this.props.status.startTime)
        }
    }

    render() {
        return (
            <div className="Started">
                <p ref={input => (this.timerElement = input)}>{this.updateTimerRef()}</p>
                <small>Current Section: {this.props.status.currentSection}</small>
                <small>Highest Section: {this.props.status.highestSection}</small>
                {/* <p>{JSON.stringify(this.props.status)}</p> */}
            </div>
        );
    }
}

export default Started;
