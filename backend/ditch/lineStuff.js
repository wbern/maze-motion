            // /*
            //     for rho,theta in lines[0]:
            //     a = np.cos(theta)
            //     b = np.sin(theta)
            //     x0 = a*rho
            //     y0 = b*rho
            //     x1 = int(x0 + 1000*(-b))
            //     y1 = int(y0 + 1000*(a))
            //     x2 = int(x0 - 1000*(-b))
            //     y2 = int(y0 - 1000*(a))

            //     cv2.line(img,(x1,y1),(x2,y2),(0,0,255),2)
            // */

            // //findContours options
            // const mode = cv.RETR_EXTERNAL;
            // const findContoursMethod = cv.CHAIN_APPROX_NONE;

            // const contours = grayDetectionMat.findContours(mode, findContoursMethod);
            // const test = flatImageMat.copyTo(new cv.Mat(), grayDetectionMat).cvtColor(cv.COLOR_BGR2GRAY);
            // test.drawContours(contours, new cv.Vec3(255,255,0));
            // cv.imshowWait("test", test);
            // let lines = []
            // for(let i = 0; i < 10; i++) {
            //     const nextLines = test.houghLinesP(rho, theta, threshold, minLineLength, maxLineGap);

            //     nextLines.forEach(line => {
            //         const y2 = line.x;
            //         const y1 = line.z;
            //         const x1 = line.y;
            //         const x2 = line.w;
            //         test.drawLine(
            //             new cv.Point2(x1, y1),
            //             new cv.Point2(x2, y2),
            //             new cv.Vec3(0, 0, 0),
            //             20
            //         );
            //     });

            //     cv.imshowWait("test", test);

            //     lines = lines.concat(nextLines);
            // }

            // lines.forEach(line => {
            //     const y2 = line.x;
            //     const y1 = line.z;
            //     const x1 = line.y;
            //     const x2 = line.w;
            //     flatImageMat.drawLine(
            //         new cv.Point2(x1, y1),
            //         new cv.Point2(x2, y2),
            //         new cv.Vec3(255, 0, 0),
            //         2
            //     );
            // });
            // cv.imshowWait("grayDetectionMat", flatImageMat);