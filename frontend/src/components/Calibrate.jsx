import React, { Component } from "react";
import {
    Grid,
    Button,
    Row,
    Col,
    FormControl,
    FormGroup,
    InputGroup,
    DropdownButton,
    MenuItem,
    Form
} from "react-bootstrap";
import { setGridByZones, getEmptyGrid, cloneGrid, getZonesByGrid } from "./Calibrate.functions";

import openSocket from "socket.io-client";

import Settings from "./Settings";
import Statistics from "./Statistics";

import "./Calibrate.css";

const clientMsg = {
    saveSection: "saveSection",
    loadSection: "loadSection",
    requestImage: "requestImage",
    requestCornerStatus: "requestCornerStatus",
    requestActiveSections: "requestActiveSections",
    requestStatus: "requestStatus",
    requestSettings: "requestSettings",
    saveSettings: "saveSettings"
};

const serverMsg = {
    disconnect: "disconnect",
    connect: "connect",
    connection: "connection",
    loadedSection: "loadedSection",
    activeImage: "activeImage",
    cornerStatus: "cornerStatus",
    activeSections: "activeSections",
    status: "status",
    settings: "settings"
};

class Calibrate extends Component {
    constructor(props) {
        super(props);

        this.state = {
            lastActiveSections: null,
            sectionIndexInputValue: 1,
            cameraFrameSkips: 5,
            cameraViewMode: "2D Image",
            availableCameraViewModes: [
                "2D Image",
                "Image",
                "Corners Mask",
                "Ball Mask",
                "Ball Background Mask",
                "Ball Color Filtered Mask"
            ],
            status: {}
        };

        this.socket = openSocket("http://localhost:8080");

        this.blockHover = this.blockHover.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onGridLoadClick = this.onGridLoadClick.bind(this);
        this.onGridSaveClick = this.onGridSaveClick.bind(this);
        this.onGridClearClick = this.onGridClearClick.bind(this);
        this.sectionIndexChange = this.sectionIndexChange.bind(this);
    }

    componentWillUnmount() {
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }

    subscribe() {
        // connection-related
        const setConnected = () => {
            this.setState({ connected: true });
            this.requestInitialData();
        };
        const setDisconnected = () => {
            this.setState({ connected: false });
        };

        if (this.socket.connected) {
            setConnected();
        } else {
            setDisconnected();
        }

        Object.keys(serverMsg).forEach(key => {
            const msg = serverMsg[key];

            this.socket.on(
                msg,
                function(data) {
                    switch (msg) {
                        case serverMsg.connect:
                            setConnected();
                            break;
                        case serverMsg.disconnect:
                            setDisconnected();
                            break;
                        case serverMsg.settings:
                            this.setState({
                                settings: data,
                                settingsUnsavedEdits: false,
                                settingsLastRetrieved: new Date().toString()
                            });
                            break;
                        case serverMsg.status:
                            this.setState({ status: data });
                            break;
                        case serverMsg.loadedSection:
                            this.grid = getEmptyGrid();
                            this.setGrid(this.grid, data.zones);
                            break;
                        case serverMsg.activeImage:
                            this.setImage(data);
                            break;
                        case serverMsg.activeSections:
                            if (data) {
                                this.setState({
                                    activeSections: data
                                });
                                this.activeGrid = getEmptyGrid();
                                data.forEach(activeSection => {
                                    this.setGrid(
                                        this.activeGrid,
                                        activeSection.zones,
                                        activeSection.index
                                    );
                                });
                            }
                            break;
                        default:
                            break;
                    }
                }.bind(this)
            );
        });
    }

    unsubscribe() {
        Object.keys(serverMsg).forEach(key => {
            const msg = serverMsg[key];
            this.socket.off(msg);
        });
    }

    requestInitialData() {
        if (!this.state.settingsUnsavedEdits) {
            // grab latest settings if no changed have been made
            this.emitIfConnected(clientMsg.requestSettings);
        }
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    componentDidMount() {
        this.grid = getEmptyGrid();
        this.activeGrid = getEmptyGrid();

        this.subscribe();

        const updateInterval = 500;
        setInterval(
            function() {
                // request things
                const updateImage = () => {
                    if (this.isImageElementUpdatable()) {
                        // image-specific
                        this.emitIfConnected(clientMsg.requestImage, {
                            cameraViewMode: this.state.cameraViewMode
                        });
                    }
                };

                setTimeout(updateImage, updateInterval * (this.state.cameraFrameSkips || 0) + 1);

                // general things
                this.emitIfConnected(clientMsg.requestActiveSections);
                this.emitIfConnected(clientMsg.requestStatus);
            }.bind(this),
            updateInterval
        );
    }

    isImageElementUpdatable() {
        return this.imageElement && this.imageLoaded !== false;
    }

    emitIfConnected(...args) {
        if (this.socket && this.socket.connected) {
            this.socket.emit.apply(this.socket, args);
        }
    }

    setImage(binaryImage) {
        const uint8Arr = new Uint8Array(binaryImage);

        if (this.isImageElementUpdatable()) {
            this.imageLoaded = false;
            const imageUrl = URL.createObjectURL(new Blob([uint8Arr], { type: "image/png" }));
            const newImage = new Image();
            newImage.onload = function() {
                this.imageElement.src = newImage.src;
            }.bind(this);
            newImage.src = imageUrl;
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
        this.socket.emit(clientMsg.loadSection, this.state.sectionIndexInputValue);
        // e.target.children.sectionIndex.value
        this.grid = getEmptyGrid();
        this.forceUpdate();
    }

    onGridSaveClick(e) {
        e.preventDefault();
        this.socket.emit(clientMsg.saveSection, {
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
                <Grid>
                    <Row>
                        <Col xs={7}>
                            <Row>
                                <Form horizontal inline>
                                    <InputGroup>
                                        <InputGroup.Addon style={{ lineHeight: 0 }}>
                                            Section
                                        </InputGroup.Addon>
                                        <FormControl
                                            type="number"
                                            name="sectionIndex"
                                            onChange={this.sectionIndexChange}
                                            onFocus={e => e.target.select()}
                                            max="61"
                                            min="0"
                                            value={this.state.sectionIndexInputValue}
                                        />
                                    </InputGroup>
                                    <InputGroup>
                                        <Button key="Load" onClick={this.onGridLoadClick}>
                                            Load
                                        </Button>
                                        <Button key="Save" onClick={this.onGridSaveClick}>
                                            Save
                                        </Button>
                                    </InputGroup>

                                    <InputGroup>
                                        <Button
                                            type="button"
                                            onClick={this.onGridClearClick}
                                            value="Clear"
                                        >
                                            Clear Current Selection
                                        </Button>
                                    </InputGroup>
                                </Form>
                            </Row>
                            <Row className="imageWrapper">
                                <div className="imageContainer">
                                    <img
                                        ref={this.saveImageRef.bind(this)}
                                        onLoad={e => {
                                            this.imageLoaded = true;
                                            URL.revokeObjectURL(e.target.src);
                                        }}
                                        className="image"
                                        alt=""
                                    />
                                    <div className="grid">
                                        {this.grid &&
                                            this.grid.map((rows, rowIndex) => (
                                                <div key={rowIndex}>
                                                    {rows.map((col, colIndex) => {
                                                        const activeValue = this.activeGrid[
                                                            rowIndex
                                                        ][colIndex];
                                                        const blockValue = this.grid[rowIndex][
                                                            colIndex
                                                        ];

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
                                                                    (activeValue
                                                                        ? " block-active"
                                                                        : "")
                                                                }
                                                            >
                                                                {activeValue !== 0
                                                                    ? this.activeGrid[rowIndex][
                                                                          colIndex
                                                                      ]
                                                                    : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </Row>
                            <Row style={{ marginTop: "15px" }}>
                                <Col xs={12}>
                                    <Form inline horizontal>
                                        <Col xs={8}>
                                            <InputGroup className="specificSizedInputGroup">
                                                <InputGroup.Addon
                                                    className="specificSizedInputGroupItems"
                                                    style={{ lineHeight: 0 }}
                                                >
                                                    Camera Mode
                                                </InputGroup.Addon>
                                                <FormControl
                                                    type="text"
                                                    disabled
                                                    className="specificSizedInputGroupItems"
                                                    value={this.state.cameraViewMode}
                                                />
                                                <DropdownButton
                                                    componentClass={InputGroup.Button}
                                                    className="specificSizedInputGroupItems"
                                                    id="input-dropdown-addon"
                                                    title="Change"
                                                >
                                                    {this.state.availableCameraViewModes.map(
                                                        name => (
                                                            <MenuItem
                                                                key={name}
                                                                onClick={() =>
                                                                    this.setState({
                                                                        cameraViewMode: name
                                                                    })
                                                                }
                                                            >
                                                                {name}
                                                            </MenuItem>
                                                        )
                                                    )}
                                                </DropdownButton>
                                            </InputGroup>
                                        </Col>
                                        <Col xs={4}>
                                            <InputGroup className="specificSizedInputGroup">
                                                <InputGroup.Addon className="specificSizedInputGroupItems">
                                                    Frame skips
                                                </InputGroup.Addon>

                                                <FormControl
                                                    type="number"
                                                    className="specificSizedInputGroupItems"
                                                    value={this.state.cameraFrameSkips}
                                                    min="0"
                                                    max="100"
                                                    onChange={e => {
                                                        this.setState({
                                                            cameraFrameSkips: Math.min(
                                                                Math.max(e.target.value, 0),
                                                                100
                                                            )
                                                        });
                                                    }}
                                                />
                                            </InputGroup>
                                        </Col>
                                    </Form>
                                </Col>
                            </Row>
                        </Col>
                        <Col xs={5}>
                            <Row>
                                <Statistics
                                    status={{
                                        connected: this.state.connected,
                                        ...this.state.status
                                    }}
                                    activeSections={this.state.activeSections}
                                    cornerStatus={this.state.status.cornerStatus}
                                    connected={this.state.connected}
                                />
                            </Row>
                            <Row>
                                <Settings
                                    loadClick={() =>
                                        this.emitIfConnected(clientMsg.requestSettings)
                                    }
                                    saveClick={() =>
                                        this.emitIfConnected(
                                            clientMsg.saveSettings,
                                            this.state.settings
                                        )
                                    }
                                    settings={this.state.settings}
                                    settingsLastRetrieved={this.state.settingsLastRetrieved}
                                    settingsUnsavedEdits={this.state.settingsUnsavedEdits}
                                    onSettingsChange={unsavedSettings =>
                                        this.setState({
                                            settings: unsavedSettings,
                                            settingsUnsavedEdits: true
                                        })
                                    }
                                    connected={this.state.connected}
                                />
                            </Row>
                        </Col>
                    </Row>
                </Grid>
            </div>
        );
    }
}

export default Calibrate;
