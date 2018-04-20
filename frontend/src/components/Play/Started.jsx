import React from "react";
import "./Started.css";

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
            let tempTime = Date.now() - new Date(this.props.status.startTime);
            const milliseconds = (tempTime % 1000).toString().substr(0,2).padStart(2, "0");
            tempTime = Math.floor(tempTime / 1000);
            const seconds = (tempTime % 60).toString().padStart(2, "0");
            tempTime = Math.floor(tempTime / 60);
            const minutes = (tempTime % 60).toString().padStart(2, "0");
            tempTime = Math.floor(tempTime / 60);
            const hours = (tempTime % 60).toString().padStart(2, "0");

            this.timerElement.innerHTML =
                hours + " : " + minutes + " : " + seconds + " : " + milliseconds;
        }
    }

    render() {
        return (
            <div className="Started">
                <p ref={input => (this.timerElement = input)}>{this.updateTimerRef()}</p>
                <small>Current Section: {this.props.status.currentSection}</small>
                <small>Highest Section: {this.props.status.highestSection}</small>
                <p>{JSON.stringify(this.props.status)}</p>
            </div>
        );
    }
}

export default Started;
