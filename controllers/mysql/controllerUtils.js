let mysql = require("mysql");

let configs = require("../../config/config.js");


let Group = require('../../models/group');
let Forum = require('../../models/forum');

exports.testTitleRegex = /[^a-z0-9!?%$#@&*-_/\\ ]/gi

exports.minSalt = 64;
exports.connection = mysql.createPool({
    connectionLimit: 100,
    host: configs.dburl,
    port: configs.port,
    user: configs.dbuser,
    password: configs.dbpass,
    database: configs.dbname
});


exports.quickErrorReturn = function(e, res) {
    console.log(e.message);
    // do something with the response
    res.send('{"error": "An error occured between the server and the database."}');
}

exports.quickErrorResponse = function(e, callback) {
    console.log(e.message);
    // do something with the response
    callback({"error": "An error occured between the server and the database."});
}

exports.makeKebab = function(str) {
    return str.replace(/\s+/g, '-').replace(/[~?&%$#@^*/\\]/,'').toLowerCase();
}

exports.createResponseFunction = function(func) {
    return function(req, res) {
        let data = Object.assign({}, req.body, req.params);
        let session = req.session;
        func(data, session, (returndata, cookieToClear) => {
            if (cookieToClear)
                res.clearCookie(cookieToClear);
            res.send(returndata);
        });
    }
}

exports.createTrueResponseFunction = function(func) {
    return function(req, res) {
        let data = Object.assign({}, req.body, req.params);
        let session = req.session;
        func(data, session, res);
    }
}

exports.incrementThreadViews = function(threadid) {
    exports.connection.query("update threads set views = views + 1 where id = ?", [threadid], (e1, r1, f1) => {
        if (e1) {
            console.log(e1);
        } else {
            // if we make it here we're good
        }
    });
}

exports.getForumHierarchy = function(callback) {

    exports.connection.query("select forums.pkey fkey, forums.id, forums.name, forums.priority, " +
	        "forums.parent parkey, if(forums.is_subforum, sf.id, gr.id) pid, if(forums.is_subforum, sf.priority, gr.priority) parpriority, forums.parent parkey, if(forums.is_subforum, sf.id, gr.id) pid, if(forums.is_subforum, sf.name, gr.name) parent, " +
            "if(forums.is_subforum, 'SUBFORUM', 'FORUM') type, ifnull(sum(thtablec), 0) threadcount, ifnull(sum(pcount), 0) postcount " +
            "from forums " +
            "left join forum_groups as gr on forums.is_subforum = 0 and forums.parent = gr.pkey " +
            "left join forums as sf on forums.is_subforum = 1 and forums.parent = sf.pkey " +
            "left join (select 1 thtablec, threads.pkey thkey, threads.parent thparent, count(*) pcount from threads " +
                "join posts on threads.pkey = posts.parent group by pkey) thtable on thparent = forums.pkey " +
            "group by forums.pkey, forums.name, parent, type;", (e, r, f) => {
        if (e) {
            console.log(e);
            throw e;
        }

        // we've gotten a list of forums and their parents. make a list of all forums, subforums, and groups. assume there are never empty groups.
        let groups = [];
        let forums = [];
        let subforums = [];
        for (let i = 0; i < r.length; i++) {
            let newForum = new Forum(r[i].fkey, r[i].id, r[i].name, r[i].pid);
            newForum.postnum = r[i].postcount;
            newForum.threadnum = r[i].threadcount;
            newForum.priority = r[i].priority;
            if (r[i].type == 'FORUM') {
                forums.push(newForum);
                let foundGroup = false;
                // only add unique groups
                for (let j = 0; j < groups.length; j++) {
                    if (groups[j].id == r[i].pid) {
                        foundGroup = true;
                        break;
                    }
                }
                if (!foundGroup) {
                    newGroup = new Group(r[i].parkey, r[i].pid, r[i].parent);
                    newGroup.priority = r[i].parpriority;
                    groups.push(newGroup);
                }
            } else if (r[i].type == 'SUBFORUM') {
                subforums.push(newForum);
            }
        }
        // assign children forums to their parents
        // ignore subforums of subforums
        for (let i = 0; i < subforums.length; i++) {
            for (let j = 0; j < forums.length; j++) {
                if (subforums[i].parent == forums[j].id) {
                    forums[j].subforums.push(subforums[i]);
                    break;
                }
            }
        }
        for (let i = 0; i < forums.length; i++) {
            for (let j = 0; j < groups.length; j++) {
                if (forums[i].parent == groups[j].id) {
                    groups[j].forums.push(forums[i]);
                    break;
                }
            }
        }

        // sort?
        groups.sort(function(a, b) { return a.priority - b.priority; });
        for (let group of groups) {
            group.forums.sort(function(a, b) { return a.priority - b.priority; });
            for (let forum of group.forums) {
                if (forum.subforums)
                    forum.subforums.sort(function(a, b) { return a.priority - b.priority; });
            }
        }
        callback(groups);
    });
}