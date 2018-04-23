import React from "react";
import "./Finish.css";
import moment from "moment";

import { Row, Col } from "react-bootstrap";

import { getTimeText } from "../Play.functions";

export class Finish extends React.Component {
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

    getNumberOneRecord() {}

    getAllRecordsButNumberOne() {}

    getPseudoRecord() {}

    getLeaderBoard() {
        this.margin = 0;

        return (
            <Row>
                <Col xs={10} xsOffset={1} className="Finish-leaderboard-wrapper">
                    <h4>Place the ball in the starting area to play.</h4>
                    <table className="Finish-leaderboard">
                        <tr>
                            <th>Rank</th>
                            <th>Sections</th>
                            <th>Seconds</th>
                            <th className="Finish-leaderboard-name">Name</th>
                            <th>Date</th>
                        </tr>
                        {this.props.records &&
                            this.props.records.map((record, recordIndex) => {
                                const currentPlayThrough = this.isCurrentPlaythrough(record);

                                return (
                                    <tr
                                        className={
                                            "Finish-leaderboard-rank-" +
                                            (recordIndex + 1) +
                                            (currentPlayThrough
                                                ? " Finish-leaderboard-current"
                                                : "")
                                        }
                                    >
                                        <td>#{recordIndex + 1}</td>
                                        <td>
                                            {record.section +
                                                " of " +
                                                this.props.status.lastSectionNumber}
                                        </td>
                                        <td>{moment.duration(record.duration).asSeconds()}</td>
                                        <td className="Finish-leaderboard-name">{record.name}</td>
                                        <td>{record.date ? moment(record.date).fromNow() : "-"}</td>
                                    </tr>
                                );
                            })}
                    </table>
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
