class db {
    constructor() {
        const low = require("lowdb");
        const FileSync = require("lowdb/adapters/FileSync");

        const adapter = new FileSync("db.json");
        this.lowdb = low(adapter);
        global.db = this.lowdb;

        this.lowdb
            .defaults({
                sections: {},
                users: {},
                playcounts: 0,
                cornerHSVMasks: [
                    {
                        min: [16, 86, 125],
                        max: [60, 255, 255]
                    }
                ],
                ballHSVMasks: [
                    { min: [30, 102, 42], max: [100, 255, 255] }
                    // want the hand? include this
                    // { min: [5, 102, 42], max: [30, 255, 255] }
                ]
            })
            .write();
    }

    writeSection(index, zones) {
        this.lowdb
            .get("sections")
            .set(index, { zones })
            .write();
    }

    getSection(index) {
        return this.lowdb
            .get("sections")
            .get(index)
            .value();
    }

    getSettings() {
        return this.lowdb.get("settings").value();        
    }

    getCornerHSVMasks() {
        return this.lowdb.get("cornerHSVMasks").value();
    }

    writeCornerHSVMasks(data) {
        return this.lowdb.set("cornerHSVMasks", data).write();
    }

    getBallHSVMasks() {
        return this.lowdb.get("ballHSVMasks").value();
    }

    getSections() {
        return this.lowdb.get("sections").value();
    }
}

module.exports = new db();
