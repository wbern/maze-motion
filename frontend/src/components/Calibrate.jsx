import React, { Component } from "react";

import "./Calibrate.css";

class Calibrate extends Component {
    constructor(props) {
        super(props);

        this.resetGrid();
        this.state = {
            sectionIndexInputValue: 1
        };

        fetch("/image")
            .then(data => data.text())
            .then(base64Image =>
                this.setState({ base64Image: "data:image/jpeg;base64," + base64Image })
            );

        this.blockHover = this.blockHover.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.loadGrid = this.loadGrid.bind(this);
        this.saveGrid = this.saveGrid.bind(this);
        this.sectionIndexChange = this.sectionIndexChange.bind(this);
    }

    sectionIndexChange(e) {
        this.setState({
            sectionIndexInputValue: e.target.value
        });
    }

    resetGrid() {
        // always assume blocks should be 10px for now
        const initialGrid = new Array(64);
        for (let i = 0; i < initialGrid.length; i++) {
            initialGrid[i] = new Array(48).fill(0);
        }

        this.grid = initialGrid;
    }

    onComponentWillReceiveProps(nextProps) {
        if (nextProps.loadedSectionInfo) {
            if (this.props.loadedSectionInfo.index !== nextProps.loadedSectionInfo.index) {
                this.loadSection(this.props.loadedSectionInfo.section)
            }
        }
    }

    loadSection(section) {
        this.resetGrid();
        
        // revert to the grid
        section.forEach(area => {
            this.grid[area.x / 10][area.y / 10] = 1;
        })

        this.setState({
            lastDrawn: null
        });
    }

    loadGrid(e) {
        e.preventDefault();
        this.props.loadSection(this.state.sectionIndexInputValue)
        // e.target.children.sectionIndex.value
        this.resetGrid();
        this.setState({
            lastDrawn: null
        });
        // this.loadedSections[]
    }

    generateSectionFromGrid(grid) {
        const section = [];

        grid.forEach((rows, rowIndex) => {
            rows.forEach((col, colIndex) => {
                if (col === 1) {
                    // enabled
                    section.push({ y: rowIndex * 10, x: colIndex * 10, width: 10, height: 10 });
                }
            });
        });

        return section;
    }

    saveGrid(e) {
        e.preventDefault();
        this.props.saveSection(
            this.generateSectionFromGrid(this.grid),
            this.state.sectionIndexInputValue
        );
    }

    blockHover(e) {
        if (this.mouseDown) {
            const [rowIndex, colIndex] = e.target.id.split("-");
            if (this.drawMode === undefined) {
                // first block, set drawmode
                this.drawMode = this.grid[rowIndex][colIndex] === 0 ? 1 : 0;
            }
            this.grid[rowIndex][colIndex] = this.drawMode;
            this.setState({
                lastDrawn: e.target.id
            });
        }
    }

    onMouseDown(e) {
        this.mouseDown = true;
        this.blockHover(e);
    }

    onMouseUp() {
        this.mouseDown = false;
        this.drawMode = undefined;
    }

    render() {
        return (
            <div className="calibrate">
                <h2>Here we calibrate stuff</h2>
                <div className="calibrateControls">
                    <form>
                        <input
                            type="number"
                            name="sectionIndex"
                            onChange={this.sectionIndexChange}
                            max="99"
                            min="1"
                            value={this.state.sectionIndexInputValue}
                        />
                    </form>
                    <input type="button" onClick={this.loadGrid} value="Load" />
                    <input type="button" onClick={this.saveGrid} value="Save" />
                </div>
                <div className="imageContainer">
                    <img className="image" src={this.state.base64Image} alt="Loading" />
                    <div className="grid">
                        {this.grid.map((rows, rowIndex) => (
                            <div>
                                {rows.map((col, colIndex) => (
                                    <div
                                        onMouseDown={this.onMouseDown}
                                        onMouseUp={this.onMouseUp}
                                        onMouseEnter={this.blockHover}
                                        id={rowIndex + "-" + colIndex}
                                        className={"block block-" + this.grid[rowIndex][colIndex]}
                                    >
                                        {/* {this.grid[rowIndex][colIndex]} */}
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
