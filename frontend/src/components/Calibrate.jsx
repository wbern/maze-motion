import React, { Component } from "react";
import {
    Grid,
    Button,
    Row,
    Col,
    FormControl,
    Checkbox,
    Panel,
    FormGroup,
    InputGroup,
    DropdownButton,
    MenuItem,
    Form,
    ControlLabel,
    PageHeader,
    ListGroup,
    ListGroupItem
} from "react-bootstrap";
import FontAwesome from "react-fontawesome";
import { setGridByZones, getEmptyGrid, cloneGrid, getZonesByGrid } from "./Calibrate.functions";

import "rc-color-picker/assets/index.css";
import ColorPicker from "rc-color-picker";

import ColorSelector from "./ColorSelector";
import CameraSettings from "./CameraSettings";
import Statistics from "./Statistics";

import "./Calibrate.css";

const clientMsg = {
    saveSection: "saveSection",
    loadSection: "loadSection",
    saveCornerHSVMasks: "saveCornerHSVMasks",
    requestCornerHSVMasks: "requestCornerHSVMasks",
    requestImage: "requestImage",
    requestCornerStatus: "requestCornerStatus",
    requestActiveSections: "requestActiveSections",
    requestStatus: "requestStatus"
};

const serverMsg = {
    disconnect: "disconnect",
    connect: "connect",
    connection: "connection",
    loadedSection: "loadedSection",
    cornerHSVMasks: "cornerHSVMasks",
    activeImage: "activeImage",
    cornerStatus: "cornerStatus",
    activeSections: "activeSections",
    status: "status"
};

class Calibrate extends Component {
    constructor(props) {
        super(props);

        this.state = {
            lastActiveSections: null,
            sectionIndexInputValue: 1,
            cameraFrameSkips: 1,
            cameraViewMode: "2D Image",
            availableCameraViewModes: ["2D Image", "Image", "Corners Mask", "Ball Mask"],
            status: {}
        };

        this.blockHover = this.blockHover.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onGridLoadClick = this.onGridLoadClick.bind(this);
        this.onGridSaveClick = this.onGridSaveClick.bind(this);
        this.onGridClearClick = this.onGridClearClick.bind(this);
        this.sectionIndexChange = this.sectionIndexChange.bind(this);
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

        if (this.props.socket.connected) {
            setConnected();
        } else {
            setDisconnected();
        }

        Object.keys(serverMsg).forEach(key => {
            const msg = serverMsg[key];

            this.props.socket.on(
                msg,
                function(data) {
                    switch (msg) {
                        case serverMsg.connect:
                            setConnected();
                            break;
                        case serverMsg.disconnect:
                            setDisconnected();
                            break;
                        case serverMsg.cornerHSVMasks:
                            this.setState({ cornerHSVMasks: data });
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
                    }
                }.bind(this)
            );
        });
    }

    unsubscribe() {
        Object.keys(serverMsg).forEach(key => {
            const msg = msg[key];
            this.props.socket.off(msg);
        });
    }

    requestInitialData() {
        this.emitIfConnected(clientMsg.requestCornerHSVMasks);
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    componentDidMount() {
        this.grid = getEmptyGrid();
        this.activeGrid = getEmptyGrid();

        this.subscribe();

        const updateInterval = 500;
        setInterval(() => {
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
        }, updateInterval);
    }

    isImageElementUpdatable() {
        return this.imageElement && this.imageLoaded !== false;
    }

    emitIfConnected(...args) {
        if (this.props.socket && this.props.socket.connected) {
            this.props.socket.emit.apply(this.props.socket, args);
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
        this.props.socket.emit(clientMsg.loadSection, this.state.sectionIndexInputValue);
        // e.target.children.sectionIndex.value
        this.grid = getEmptyGrid();
        this.forceUpdate();
    }

    onGridSaveClick(e) {
        e.preventDefault();
        this.props.socket.emit(clientMsg.saveSection, {
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

    saveHsvMaskRanges(maskName, ranges) {
        if (maskName === "cornerHSVMasks") {
            this.emitIfConnected(clientMsg.saveCornerHSVMasks, ranges);
        }
    }

    render() {
        return (
            <div className="calibrate">
                <Grid>
                    <Row>
                        <Col xs={7}>
                            <Row>
                                <Col xs={4} xsOffset={1}>
                                    <FormGroup>
                                        <InputGroup className="specificSizedInputGroup">
                                            <InputGroup.Addon
                                                className="specificSizedInputGroupItems"
                                                style={{ lineHeight: 0 }}
                                            >
                                                Section
                                            </InputGroup.Addon>
                                            <FormControl
                                                type="number"
                                                className="specificSizedInputGroupItems"
                                                name="sectionIndex"
                                                onChange={this.sectionIndexChange}
                                                max="61"
                                                min="0"
                                                value={this.state.sectionIndexInputValue}
                                            />
                                            <DropdownButton
                                                componentClass={InputGroup.Button}
                                                className="specificSizedInputGroupItems"
                                                id="input-dropdown-addon"
                                                title="Action"
                                            >
                                                <MenuItem key="Load" onClick={this.onGridLoadClick}>
                                                    Load
                                                </MenuItem>
                                                <MenuItem key="Save" onClick={this.onGridSaveClick}>
                                                    Save
                                                </MenuItem>
                                            </DropdownButton>
                                        </InputGroup>
                                    </FormGroup>
                                </Col>
                                <Col xs={2}>
                                    <Form>
                                        <InputGroup
                                            className="specificSizedInputGroup"
                                            style={{ width: "100%" }}
                                        >
                                            <Button
                                                type="button"
                                                className="specificSizedInputGroupItems"
                                                style={{ width: "100%" }}
                                                onClick={this.onGridClearClick}
                                                value="Clear"
                                            >
                                                Clear
                                            </Button>
                                        </InputGroup>
                                    </Form>
                                </Col>
                                <Col xs={4} />
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
                        </Col>
                        <Col xs={5}>
                            <Row>
                                <Statistics
                                    status={{connected: this.state.connected, ...this.state.status}}
                                    activeSections={this.state.activeSections}
                                    cornerStatus={this.state.status.cornerStatus}
                                    connected={this.state.connected}
                                />
                            </Row>
                            <Row>
                                <CameraSettings />
                            </Row>
                        </Col>
                    </Row>
                    <Row style={{ marginTop: "15px" }}>
                        <Col xs={12}>
                            <Col xs={7}>
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
                                                {this.state.availableCameraViewModes.map(name => (
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
                                                ))}
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
                            {/* <Col xs={5} xsOffset={2}>
                            <ColorSelector textLabel="Ball Color Ranges" />
                        </Col> */}
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12}>
                            <h1 className="text-left">Color Calibration</h1>
                            <Col xs={7}>
                                <ColorSelector
                                    onChange={ranges =>
                                        this.saveHsvMaskRanges("cornerHSVMasks", ranges)
                                    }
                                    defaultItems={this.state.cornerHSVMasks}
                                    textLabel="Corner Color Ranges"
                                />
                            </Col>
                            {/* <Col xs={5} xsOffset={2}>
                            <ColorSelector textLabel="Ball Color Ranges" />
                        </Col> */}
                        </Col>
                    </Row>
                </Grid>
            </div>
        );
    }
}

export default Calibrate;
