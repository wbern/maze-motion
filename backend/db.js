class db {
    constructor() {
        const low = require("lowdb");
        const FileSync = require("lowdb/adapters/FileSync");

        const adapter = new FileSync("db.json");
        this.lowdb = low(adapter);
        global.db = this.lowdb;

        this.lowdb.defaults({ sections: {}, users: {}, playcounts: 0 }).write();
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

    getSections() {
        return this.lowdb.get("sections").value();
    }
}

module.exports = new db();
