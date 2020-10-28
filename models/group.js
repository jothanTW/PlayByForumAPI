let Group = function(dbid, id, name) {
    this.dbid - dbid;
    this.id = id;
    this.name = name;
    // backup
    this.title = name;
    this.priority = 0;

    this.forums = [];
}

module.exports = Group;