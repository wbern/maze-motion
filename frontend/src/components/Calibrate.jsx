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

const messages = {
    // subscriptions
    loadedSection: "loadedSection",
    activeImage: "activeImage",
    activeSections: "activeSections",
    cornerStatus: "cornerStatus",
    cornerHSVMasks: "cornerHSVMasks",
    // emits
    requestImage: "requestImage",
    requestActiveSections: "requestActiveSections",
    requestCornerStatus: "requestCornerStatus",
    loadSection: "loadSection",
    saveSection: "saveSection",
    saveCornerHSVMasks: "saveCornerHSVMasks",
    requestCornerHSVMasks: "requestCornerHSVMasks"
};

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

    subscribe() {
        // connection-related
        const setConnected = function() {
            this.setState({ connected: true });
            this.requestInitialData();
        }.bind(this);
        const setDisconnected = function() {
            this.setState({ connected: false });
        }.bind(this);

        this.props.socket.on("connect", setConnected);
        this.props.socket.on("disconnect", setDisconnected);

        if (this.props.socket.connected) {
            setConnected();
        } else {
            setDisconnected();
        }

        // to get hsv corner masks
        const loadedCornerHSVMasks = function(cornerHSVMasks) {
            this.setState({ cornerHSVMasks });
        }.bind(this);
        this.props.socket.on(messages.cornerHSVMasks, loadedCornerHSVMasks);

        // get statuses
        this.props.socket.on(
            messages.cornerStatus,
            function(cornerStatus) {
                this.setState({ cornerStatus });
            }.bind(this)
        );

        // section-related
        this.props.socket.on(
            messages.loadedSection,
            function(loadedSectionInfo) {
                this.grid = getEmptyGrid();
                this.setGrid(this.grid, loadedSectionInfo.zones);
            }.bind(this)
        );
        this.props.socket.on(messages.activeImage, this.setImage.bind(this));
        this.props.socket.on(
            messages.activeSections,
            function(activeSections) {
                if (activeSections) {
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
    }

    unsubscribe() {
        this.props.socket.off(messages.loadedSection);
        this.props.socket.off(messages.activeImage);
        this.props.socket.off(messages.activeSections);
        this.props.socket.off(messages.cornerStatus);
    }

    requestInitialData() {
        this.emitIfConnected(messages.requestCornerHSVMasks);
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    componentDidMount() {
        this.grid = getEmptyGrid();
        this.activeGrid = getEmptyGrid();

        this.subscribe();

        setInterval(() => {
            // request things
            const updateImage = () => {
                if (this.isImageElementUpdatable()) {
                    // image-specific
                    this.emitIfConnected(messages.requestImage, {
                        showMaskedImage: this.state.showMaskedImage
                    });
                }
            };

            // general things
            this.emitIfConnected(messages.requestActiveSections);
            this.emitIfConnected(messages.requestCornerStatus);
        }, 500);
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
            // this.imageElement.src = "data:image/jpeg;base64," + blob;
            this.imageElement.src = imageUrl;
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
        this.props.socket.emit(messages.loadSection, this.state.sectionIndexInputValue);
        // e.target.children.sectionIndex.value
        this.grid = getEmptyGrid();
        this.forceUpdate();
    }

    onGridSaveClick(e) {
        e.preventDefault();
        this.props.socket.emit(messages.saveSection, {
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
            this.props.socket.emit(messages.saveCornerHSVMasks, ranges);
        }
    }

    render() {
        return (
            <div className="calibrate">
                <Grid>
                    <Row>
                        <Col xs={7}>
                            <Row>
                                <Col xs={4}>
                                    <FormGroup>
                                        <InputGroup>
                                            <FormControl
                                                type="number"
                                                name="sectionIndex"
                                                onChange={this.sectionIndexChange}
                                                max="61"
                                                min="0"
                                                value={this.state.sectionIndexInputValue}
                                            />
                                            <DropdownButton
                                                componentClass={InputGroup.Button}
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
                                        <Button
                                            type="button"
                                            onClick={this.onGridClearClick}
                                            value="Clear"
                                        >
                                            Clear
                                        </Button>
                                    </Form>
                                </Col>
                                <Col xs={6}>
                                    <Form>
                                        {/* <Checkbox
                                            value={this.state.showMaskedImage}
                                            onClick={e => {
                                                this.setState({
                                                    showMaskedImage: e.target.checked
                                                });
                                            }}
                                        >
                                            Mask
                                        </Checkbox> */}
                                        <InputGroup>
                                            <InputGroup.Addon>Frame skips</InputGroup.Addon>

                                            <FormControl
                                                type="number"
                                                value={this.state.cameraFrameSkips || 5}
                                                onChange={e => {
                                                    this.setState({
                                                        cameraFrameSkips: e.target.value
                                                    });
                                                }}
                                            />
                                        </InputGroup>
                                    </Form>
                                </Col>
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
                                    activeSections={this.state.activeSections}
                                    cornerStatus={this.state.cornerStatus}
                                    connected={this.state.connected}
                                />
                            </Row>
                            <Row>
                                <CameraSettings />
                            </Row>
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12}>
                            <h1 className="text-left">Color Calibration</h1>
                            <Col xs={5}>
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
