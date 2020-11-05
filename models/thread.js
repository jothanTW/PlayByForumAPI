let Thread = function(id, name, owner, parent, postnum, views, isGameThread) {
    this.id = id;
    this.name = name;
    this.title = name;
    this.owner = owner;
    this.parent = parent;
    this.isGameThread = false;
    this.postnum = 0;
    this.views = 0;
    if (postnum) this.postnum = postnum;
    if (views) this.views = views;
    if (isGameThread) this.isGameThread = true;

    this.last_post_time = new Date();
    this.last_poster = "";
}

module.exports = Thread;