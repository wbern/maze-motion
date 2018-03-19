import React, { Component } from "react";

import "./Calibrate.css";

class Calibrate extends React.Component {
    constructor(props) {
        super(props);

        const initialGrid = new Array(64);
        for (let i = 0; i < initialGrid.length; i++) {
            initialGrid[i] = new Array(48).fill(0);
        }

        this.state = {
            grid: initialGrid
        };

        fetch("/image")
            .then(data => data.text())
            .then(base64Image =>
                this.setState({ base64Image: "data:image/jpeg;base64," + base64Image })
            );

        this.blockHover = this.blockHover.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }

    componentWillMount() {}

    blockHover(e) {
        if (this.mouseDown) {
            const newGrid = this.state.grid;
            let [rowIndex, colIndex] = e.target.id.split("-");
            // newGrid[rowIndex][colIndex] = [...newGrid[rowIndex][colIndex]];
            newGrid[rowIndex][colIndex] = newGrid[rowIndex][colIndex] === 0 ? 1 : 0;

            this.setState({
                grid: newGrid
            });
        }
    }

    onMouseDown() {
        this.mouseDown = true;
    }

    onMouseUp() {
        this.mouseDown = false;
    }

    render() {
        return (
            <div className="calibrate">
                <h2>Here we calibrate stuff</h2>
                <div className="imageContainer">
                    <img className="image" src={this.state.base64Image} alt="Loading" />
                    <div className="grid">
                        {this.state.grid.map((rows, rowIndex) => (
                            <div>
                                {rows.map((col, colIndex) => (
                                    <div
                                        onMouseDown={this.onMouseDown}
                                        onMouseUp={this.onMouseUp}
                                        onMouseEnter={this.blockHover}
                                        id={rowIndex + "-" + colIndex}
                                        className={
                                            "block" +
                                            " block-" +
                                            this.state.grid[rowIndex][colIndex]
                                        }
                                    >
                                        {this.state.grid[rowIndex][colIndex]}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
}

export default Calibrate;
