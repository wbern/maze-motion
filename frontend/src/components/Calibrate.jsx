import React, { Component } from "react";
import { setGridByZones, getEmptyGrid, cloneGrid, getZonesByGrid } from "./Calibrate.functions";

import "./Calibrate.css";

class Calibrate extends Component {
    constructor(props) {
        super(props);

        this.state = {
            lastActiveSections: null,
            sectionIndexInputValue: 1
        };

        this.blockHover = this.blockHover.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onGridLoadClick = this.onGridLoadClick.bind(this);
        this.onGridSaveClick = this.onGridSaveClick.bind(this);
        this.onGridClearClick = this.onGridClearClick.bind(this);
        this.sectionIndexChange = this.sectionIndexChange.bind(this);
    }

    componentDidMount() {
        this.grid = getEmptyGrid();
        this.activeGrid = getEmptyGrid();

        this.props.socket.on(
            "loadedSection",
            function(loadedSectionInfo) {
                this.grid = getEmptyGrid();
                this.setGrid(this.grid, loadedSectionInfo.zones);
            }.bind(this)
        );
        this.props.socket.on("activeImage", this.setImage.bind(this));
        this.props.socket.on(
            "activeSections",
            function(activeSections) {
                if(activeSections) {
                    this.setState({
                        activeSections
                    });
                    this.activeGrid = getEmptyGrid();
                    activeSections.forEach(activeSection => {
                        this.setGrid(this.activeGrid, activeSection.zones, activeSection.index);
                    });
                }
            }.bind(this)
        );

        setInterval(() => {
            if (this.props.socket.connected && this.isImageElementReady()) {
                this.props.socket.emit("requestImage");
                this.props.socket.emit("requestActiveSections");
            }
        }, 550);

        // fetch("/image")
        //     .then(data => data.text())
        //     .then(base64Image => this.setImage(base64Image));
    }

    isImageElementReady() {
        return this.imageElement && this.imageLoaded !== false;
    }

    setImage(base64Image) {
        if (this.isImageElementReady()) {
            this.imageLoaded = false;
            this.imageElement.src = "data:image/jpeg;base64," + base64Image;
        }
    }

    sectionIndexChange(e) {
        this.setState({
            sectionIndexInputValue: e.target.value
        });
    }

    // used during drawing
    stashGrid() {
        this.stashedGrid = cloneGrid(this.grid);
    }

    // used during drawing
    popGrid() {
        this.grid = cloneGrid(this.stashedGrid);
    }

    setGrid(gridReference, zones, blockValue) {
        // revert to the grid, if it exists
        if (zones) {
            setGridByZones(zones, gridReference, blockValue);

            this.setState({
                lastDrawn: null
            });
        }
    }

    onGridLoadClick(e) {
        e.preventDefault();
        this.props.socket.emit("loadSection", this.state.sectionIndexInputValue);
        // e.target.children.sectionIndex.value
        this.grid = getEmptyGrid();
        this.forceUpdate();
    }

    onGridSaveClick(e) {
        e.preventDefault();
        this.props.socket.emit("saveSection", {
            zones: getZonesByGrid(this.grid),
            resolution: { height: 480, width: 640 },
            index: this.state.sectionIndexInputValue
        });
    }

    onGridClearClick() {
        this.grid = getEmptyGrid();
        this.setState({
            lastDrawn: null
        });
    }

    performOnBlocks(rowIndexString, colIndexString, callback) {
        const rowIndex = Number(rowIndexString);
        const colIndex = Number(colIndexString);
        const initialR = Number(this.initialBlock[0]);
        const initialC = Number(this.initialBlock[1]);

        // to make sure we can also go backwards
        const rowInvertValue = (rowIndex - initialR) / Math.abs(rowIndex - initialR) || 1;
        const colInvertValue = (colIndex - initialC) / Math.abs(colIndex - initialC) || 1;

        // * start at last point
        // * iterate backwards until below 0
        for (let currentRow = Math.abs(rowIndex - initialR); currentRow >= 0; currentRow--) {
            for (let currentCol = Math.abs(colIndex - initialC); currentCol >= 0; currentCol--) {
                callback(
                    (initialR + currentRow * rowInvertValue).toString(),
                    (initialC + currentCol * colInvertValue).toString()
                );
            }
        }
    }

    blockHover(e) {
        if (this.mouseDown) {
            const [rowIndex, colIndex] = e.target.id.split("-");
            if (this.drawMode === undefined) {
                // first block, set drawmode
                this.drawMode = this.grid[rowIndex][colIndex] === 0 ? 1 : 0;
            }
            // draw the tiles
            this.popGrid();
            this.performOnBlocks(rowIndex, colIndex, (r, c) => {
                this.grid[r][c] = this.drawMode;
            });
            this.setState({
                lastDrawn: e.target.id
            });
        }
    }

    onMouseDown(e) {
        if (e.button === 0) {
            this.mouseDown = true;
            this.stashGrid();
            this.initialBlock = e.target.id.split("-");
            this.blockHover(e);
        }
    }

    onMouseUp(e) {
        if (e.button === 0) {
            this.stashGrid();
            this.mouseDown = false;
            this.drawMode = undefined;
        }
    }

    saveImageRef(submit) {
        if (submit) {
            this.imageElement = submit;
        }
    }

    render() {
        return (
            <div className="calibrate">
                <h2>
                    Here we calibrate stuff (active index:{" "}
                    {this.state.activeSections && JSON.stringify(this.state.activeSections.map(s => s.index))})
                </h2>
                <div className="calibrateControls">
                    <form>
                        <input
                            type="number"
                            className="formControl"
                            name="sectionIndex"
                            onChange={this.sectionIndexChange}
                            max="99"
                            min="0"
                            value={this.state.sectionIndexInputValue}
                        />
                    </form>
                    <input className="formControl" type="button" onClick={this.onGridLoadClick} value="Load" />
                    <input className="formControl" type="button" onClick={this.onGridSaveClick} value="Save" />
                    <input className="formControl" type="button" onClick={this.onGridClearClick} value="Clear" />
                </div>
                <div className="imageContainer">
                    <img
                        ref={this.saveImageRef.bind(this)}
                        onLoad={() => (this.imageLoaded = true)}
                        className="image"
                        src={this.state.base64Image}
                        alt="Loading"
                    />
                    <div className="grid">
                        {this.grid &&
                            this.grid.map((rows, rowIndex) => (
                                <div key={rowIndex}>
                                    {rows.map((col, colIndex) => {
                                        const activeValue = this.activeGrid[rowIndex][colIndex];
                                        const blockValue = this.grid[rowIndex][colIndex];

                                        return (
                                            <div
                                                key={colIndex}
                                                onMouseDown={this.onMouseDown}
                                                onMouseUp={this.onMouseUp}
                                                onMouseEnter={this.blockHover}
                                                id={rowIndex + "-" + colIndex}
                                                className={
                                                    "block block-" +
                                                    blockValue +
                                                    (activeValue ? " block-active" : "")
                                                }
                                            >
                                                {activeValue !== 0 ? this.activeGrid[rowIndex][colIndex] : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        );
    }
}

export default Calibrate;
