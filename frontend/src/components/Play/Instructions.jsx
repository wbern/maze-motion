import React from "react";
import "./Instructions.css";

export class Instructions extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    render() {
        return (
            <div className="Instructions">
                <p>Put the ball in the starting area to get ready</p>
                <p>{JSON.stringify(this.props.status)}</p>
            </div>
        );
    }
}

export default Instructions