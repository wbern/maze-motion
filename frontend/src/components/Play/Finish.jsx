import React from "react";
import "./Finish.css";

export class Finish extends React.Component {
    componentWillMount() {}

    componentDidMount() {}

    render() {
        return (
            <div className="Finish">
                <p>Finish!</p>
                <p>{JSON.stringify(this.props.status)}</p>
            </div>
        );
    }
}

export default Finish