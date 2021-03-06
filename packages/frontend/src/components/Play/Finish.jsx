import React from "react";
import "./Finish.css";
import moment from "moment";
import seed from "seed-random";
import { emojis } from "../../Constants";

import { Row, Col, ProgressBar } from "react-bootstrap";

import { getTimeText } from "../Play.functions";

import Confetti from "react-confetti";

export class Finish extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showAllRecords: false,
            recordLimit: 10
        };

        this.getRecord = this.getRecord.bind(this);
    }

    componentWillMount() {}

    componentDidMount() {
        // document.querySelector(".Finish-leaderboard-wrapper").scroll(0, document.querySelector(".Finish-leaderboard-rank-12").offsetTop)
    }

    getFinishInformation() {
        const beatTheGame =
            this.props.status.lastSectionNumber === this.props.status.highestSection;

        if (beatTheGame) {
            return (
                <div>
                    <p>You beat the game!</p>
                    <p>
                        Your time:{" "}
                        {getTimeText(this.props.status.startTime, this.props.status.endTime)}
                    </p>
                </div>
            );
        } else {
            return (
                <div>
                    <p>Game Over</p>
                    <p>
                        Your time:{" "}
                        {getTimeText(this.props.status.startTime, this.props.status.endTime)}
                    </p>
                    {this.props.status.currentSection !== this.props.status.highestSection && (
                        <p>Fell in section: {this.props.status.currentSection}</p>
                    )}
                    <p>Section: {this.props.status.highestSection}</p>
                </div>
            );
        }
    }

    isCurrentPlaythrough(record) {
        return record.id === this.props.status.id;

        // const diff = moment(new Date(this.props.status.startTime)).diff(moment(record.date));

        // return (
        //     record.name === this.props.status.currentName &&
        //     record.section === this.props.status.highestSection &&
        //     diff === 0
        // );
    }

    getRandomEmojiiByText(text) {
        const rng = seed(text, { global: false });
        const index = Math.floor(rng() * emojis.length);
        return emojis[index];
    }

    getRecord(record, index) {
        const currentPlayThrough = this.isCurrentPlaythrough(record);

        let seconds = moment
            .duration(record.duration)
            .asSeconds()
            .toFixed(1);
        if (parseFloat(seconds) === Math.round(seconds)) {
            seconds = parseInt(seconds, 10).toString();
        }

        return (
            <tr
                key={index + 1}
                className={
                    "Finish-leaderboard-rank-" +
                    (index + 1) +
                    (currentPlayThrough ? " Finish-leaderboard-current" : "")
                }
            >
                <td>#{index + 1}</td>
                <td>
                    <ProgressBar
                        bsStyle="success"
                        now={record.section / this.props.status.lastSectionNumber * 100}
                        label={record.section}
                    />
                </td>
                <td>{seconds}</td>
                <td className="Finish-leaderboard-name">
                    {this.getRandomEmojiiByText(record.name) + " " + record.name}
                </td>
                <td>{record.date ? moment(record.date).fromNow() : "-"}</td>
            </tr>
        );
    }

    getRecords() {
        if (!this.props.records) {
            return null;
        }

        let results = null;

        if (!this.state.showAllRecords) {
            results = this.props.records.slice(0, this.state.recordLimit).map(this.getRecord);

            if (this.props.status.rank > this.state.recordLimit) {
                results.push(
                    <tr key="...">
                        <td>...</td>
                    </tr>
                );
                results.push(
                    this.getRecord(
                        this.props.records[this.props.status.rank - 1],
                        this.props.status.rank - 1
                    )
                );
            }
        } else {
            results = this.props.records.map(this.getRecord);
        }

        return results;
    }

    getFinishGreetMessage() {
        let message = "";
        let confetti = false;

        if (
            this.props.status.highestSection &&
            this.props.status.highestSection === this.props.status.lastSectionNumber
        ) {
            message = "Congratulations, you beat the game!";
            confetti = true;
        } else if (this.props.status.rank && this.props.status.rank <= this.state.recordLimit) {
            message = "Well done, you're in the top " + this.state.recordLimit + ".";
        } else {
            message = "Game Over";
        }

        return (
            <div>
                {confetti && (
                    <div
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            width: window.innerWidth + "px",
                            height: window.innerHeight + "px"
                        }}
                    >
                        <Confetti width={window.innerWidth} height={window.innerHeight} />
                    </div>
                )}
                <h1>{message}</h1>
            </div>
        );
    }

    getLeaderBoard() {
        return (
            <Row className="Finish-row">
                <Col xs={10} xsOffset={1} className="Finish-leaderboard-wrapper">
                    {this.getFinishGreetMessage()}
                    <h4>Place the ball in the starting area to play.</h4>
                    {this.props.records &&
                        this.props.status.lastSectionNumber && (
                            <table className="Finish-leaderboard">
                                <tbody>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Sections</th>
                                        <th>Seconds</th>
                                        <th className="Finish-leaderboard-name">Name</th>
                                        <th>Date</th>
                                    </tr>
                                    {this.getRecords()}
                                </tbody>
                            </table>
                        )}
                    <h4
                        onClick={() =>
                            this.setState({ showAllRecords: !this.state.showAllRecords })
                        }
                        className="Finish-showAllButton"
                    >
                        {this.state.showAllRecords ? "Collapse" : "Show all"}
                    </h4>
                </Col>
            </Row>
        );
    }

    render() {
        return (
            <div className="Finish">
                {/* {this.getFinishInformation()} */}
                {this.getLeaderBoard()}
            </div>
        );
    }
}

export default Finish;
