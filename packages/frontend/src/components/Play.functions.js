export function getTimeText(startTime, endTime = Date.now()) {
    let tempTime = new Date(endTime) - new Date(startTime);

    const milliseconds = (tempTime % 1000)
        .toString()
        .substr(0, 2)
        .padStart(2, "0");
    tempTime = Math.floor(tempTime / 1000);
    const seconds = (tempTime % 60).toString().padStart(2, "0");
    tempTime = Math.floor(tempTime / 60);
    const minutes = (tempTime % 60).toString().padStart(2, "0");
    tempTime = Math.floor(tempTime / 60);
    const hours = (tempTime % 60).toString().padStart(2, "0");

    return hours + " : " + minutes + " : " + seconds + " : " + milliseconds;
}
