const fs = require("fs");

class db {
    constructor() {
        const dbName = "db";

        this.cached = {};

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

    writeSection(index, zones) {
        this.lowdb
            .get("sections")
            .set(index, { zones })
            .write();

        this.cached.sections = null;
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

    writeSettings(data) {
        return this.lowdb.set("settings", data).write();       
    }

    // getCornerHSVMasks() {
    //     return this.lowdb.get("cornerHSVMasks").value();
    // }

    // writeCornerHSVMasks(data) {
    //     return this.lowdb.set("cornerHSVMasks", data).write();
    // }

    getBallHSVMasks() {
        return this.lowdb.get("ballHSVMasks").value();
    }

    getSections() {
        if(!this.cached.sections) {
            this.cached.sections = this.lowdb.get("sections").value();
        }
        return this.cached.sections;
    }
}

module.exports = new db();
