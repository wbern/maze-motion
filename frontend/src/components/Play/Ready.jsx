import React from "react";
import "./Ready.css";

export class Ready extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    render() {
        return (
            <div className="Ready">
                <p>Ball is in position. Ready when you are!</p>
                {/* <p>{JSON.stringify(this.props.status)}</p> */}
            </div>
        );
    }
}

export default Ready;
