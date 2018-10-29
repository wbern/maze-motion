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

        this.lowdb.defaults(defaults).write();
    }

    writeSection(index, zones) {
        this.lowdb
            .get("sections")
            .set(index, { zones })
            .write();

        this.cached.pigeonHoledSection = null;
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
        if (!this.cached.sections) {
            this.cached.sections = this.lowdb.get("sections").value();
        }
        return this.cached.sections;
    }

    getPigeonHoledSections(maxWidth, maxHeight) {
        if (!this.cached.pigeonHoledSection) {
            const sections = this.getSections();
            const result = new Array(maxWidth + 1)
                .fill(0)
                .map(() => new Array(maxHeight + 1).fill(0).map(() => ({})));

            Object.keys(sections).forEach(sectionNumber => {
                sections[sectionNumber].zones.forEach(zone => {
                    for (var col = zone.x; col < zone.x + zone.width; col++) {
                        for (var row = zone.y; row < zone.y + zone.height; row++) {
                            // section X is active in col Y and row Z
                            result[col][row][sectionNumber] = true;
                        }
                    }
                });
            });

            this.cached.pigeonHoledSection = result;
        }
        return this.cached.pigeonHoledSection;
    }
}

module.exports = new db();
