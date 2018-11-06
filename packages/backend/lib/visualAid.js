const cv = require("opencv4nodejs");

module.exports = {
    drawBoardLines: (mat, lines = [], color = new cv.Vec3(255, 0, 0)) => {
        lines.forEach(line => {
            mat.drawLine(
                new cv.Point2(line.x1, line.y1),
                new cv.Point2(line.x2, line.y2),
                color,
                1
            );
        });
    },
    drawBoardCorners: (mat, corners = []) => {
        corners.forEach(point => {
            mat.drawCircle(
                new cv.Point2(point.x, point.y),
                3,
                new cv.Vec3(255, 0, 0),
                2
            );
        });
    },
    // drawBoardCenter: (mat, center) => {
    //     if(center) {
    //         mat.drawCircle(
    //             new cv.Point2(center.x, center.y),
    //             8,
    //             new cv.Vec3(255, 0, 255),
    //             2
    //         );
    //     }
    // },
    drawBalls: (mat, balls = []) => {
        balls.forEach(circle => {
            // mat.drawEllipse(circle, new cv.Vec3(255, 0, 0), 2);
            mat.drawCircle(
                new cv.Point2(circle.center.x, circle.center.y),
                1,
                new cv.Vec3(255, 255, 0),
                2
            );
        });
    }
}