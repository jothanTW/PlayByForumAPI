let Character = function(dbid, id, name, user, title, av) {
    this.dbid = dbid;
    this.id = id;
    this.name = name;
    this.user = user;
    this.title = "";
    this.av = "";
    if (title) this.title = title;
    if (av) this.av = av;
    this.icon = this.av;
    this.statBlock = {};
    this.bio = "";
}

module.exports = Character;