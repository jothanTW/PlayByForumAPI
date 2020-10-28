let Forum = function(dbid, id, name, parent, threadnum, postnum) {
    this.dbid = dbid;
    this.id = id;
    this.name = name;
    // backup
    this.title = name;
    this.parent = parent;
    this.threadnum = 0;
    this.postnum = 0;
    if (threadnum) this.threadnum = threadnum;
    if (postnum) this.postnum = postnum;
    this.priority = 0;

    this.subforums = [];
}

module.exports = Forum;