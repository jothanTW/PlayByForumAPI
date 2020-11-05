let Role = function(type, forum) {
    this.type = type;
    this.forum = "";
    if (forum) this.forum = forum;
}

module.exports = Role;