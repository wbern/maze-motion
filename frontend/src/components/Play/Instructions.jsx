import React from "react";
import "./Instructions.css";

export class Instructions extends React.Component {
    render() {
        return (
            <div className="Instructions">
                <p>Put the ball in the starting area</p>
                {/* <p>{JSON.stringify(this.props.status)}</p> */}
            </div>
        );
    }
}

export default Instructions