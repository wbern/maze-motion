const fs = require("fs");

class db {
    constructor() {
        const dbName = "game-db";

        const low = require("lowdb");
        const FileSync = require("lowdb/adapters/FileSync");

        const adapter = new FileSync(dbName + ".json");
        const defaults = JSON.parse(fs.readFileSync("./" + dbName + "-defaults.json"));
        this.lowdb = low(adapter);
        global.db = this.lowdb;

        this.lowdb
            .defaults(defaults)
            .write();
    }

    // writeSection(index, zones) {
    //     this.lowdb
    //         .get("sections")
    //         .set(index, { zones })
    //         .write();
    // }

    // getSection(index) {
    //     return this.lowdb
    //         .get("sections")
    //         .get(index)
    //         .value();
    // }
}

module.exports = new db();
