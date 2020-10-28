let Post = function(parent, num, user, text, date) {
    this.parent = parent;
    this.num = num;
    this.user = user;
    this.text = text;
    this.ooc = "";
    this.date = date;
    this.revStack = 0;
}

module.exports = Post;