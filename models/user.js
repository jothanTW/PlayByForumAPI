let User = function(dbid, id, title, email) {
    this.dbid = dbid;
    this.id = id;
    this.title = title;
    this.email = "";
    if (email) this.email = email;
    this.roles = [];
    this.icon = "";
}

module.exports = User;