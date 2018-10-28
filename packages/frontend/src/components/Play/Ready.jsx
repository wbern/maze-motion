import React from "react";
import "./Ready.css";

export class Ready extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    render() {
        return (
            <div className="Ready">
                <span>Ball is in position, {this.props.children}.</span>
                <span>Ready when you are!</span>
                {/* <p>{JSON.stringify(this.props.status)}</p> */}
            </div>
        );
    }
}

export default Ready;
