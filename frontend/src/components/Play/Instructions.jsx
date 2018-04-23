import React from "react";
import "./Instructions.css";

export class Instructions extends React.Component {
    render() {
        return (
            <div className="Instructions">
                <span>Put the ball in the starting area, {this.props.children}</span>
                {/* <p>{JSON.stringify(this.props.status)}</p> */}
            </div>
        );
    }
}

export default Instructions