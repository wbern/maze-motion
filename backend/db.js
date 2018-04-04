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

    getBallMasks() {
        return this.lowdb.get("ballHSVMasks").value();
    }

    getSections() {
        return this.lowdb.get("sections").value();
    }
}

module.exports = new db();
