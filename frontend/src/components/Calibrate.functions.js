export function setGridByZones(zones, grid) {
    if (zones) {
        zones.forEach(zone => {
            for (var yOffset = zone.height / 10 - 1; yOffset >= 0; yOffset--) {
                for (var xOffset = zone.width / 10 - 1; xOffset >= 0; xOffset--) {
                    grid[zone.x / 10 + xOffset][zone.y / 10 + yOffset] = 1;
                }
            }
        });
    }
}

export function getZonesByGrid(grid) {
    const section = [];

    grid.forEach((rows, colIndex) => {
        rows.forEach((col, rowIndex) => {
            if (col === 1) {
                // enabled
                section.push({ y: rowIndex * 10, x: colIndex * 10, width: 10, height: 10 });
            }
        });
    });

    return section;
}

export function getEmptyGrid() {
    const initialGrid = new Array(64);
    for (let i = 0; i < initialGrid.length; i++) {
        initialGrid[i] = new Array(48).fill(0);
    }
    return initialGrid;
}

export function cloneGrid(grid) {
    return JSON.parse(JSON.stringify(grid))
}