let utils = require("./controllerUtils");
let request = require("request-promise-native");

exports.getGroupsData = function(data, session, returndata) {
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/groups-and-forums",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(jdat => {
        // we should be given an object with a "rows" array that contains group objects and the forums that belong to them
        // arrange them as an array of groups containing forums
        let senddat = [];
        let forums = [];
        let subforums = [];
        for (let row of jdat.rows) {
            if (row.value.type == "group") {
                senddat.push({
                        title: row.value.title,
                        id: row.value.id,
                        priority: row.value.priority,
                        forums: []
                    });
            } else if (row.value.top) {
                forums.push({
                    title: row.value.title,
                    id: row.value.id,
                    parent: row.value.parent,
                    threadnum: row.value.threadnum,
                    posts: row.value.posts,
                    priority: row.value.priority,
                    subforums: []
                });
            } else {
                subforums.push({
                    title: row.value.title,
                    id: row.value.id,
                    priority: row.value.priority,
                    parent: row.value.parent
                })
            }
        }
        // put subforums in parent forums
        for (let sub of subforums) {
            // locate the parent
            let parenti = 0;
            for (; parenti < forums.length; parenti++) {
                if (sub.parent == forums[parenti].id) {
                    break;
                }
            }
            if (parenti < forums.length) { // found the parent
                delete sub.parent;
                forums[parenti].subforums.push(sub);
            }
        }

        // now add the forums to the proper groups
        for (let forum of forums) {
            // locate the parent
            let parenti = 0;
            for (; parenti < senddat.length; parenti++) {
                if (forum.parent == senddat[parenti].id) {
                    break;
                }
            }
            if (parenti < senddat.length) { // found the parent
                delete forum.parent;
                if (forum.subforums.length == 0)
                    delete forum.subforums;
                senddat[parenti].forums.push(forum);
            }
        }

        // sort everything
        senddat.sort(function(a, b) { return a.priority - b.priority; });
        for (let group of senddat) {
            group.forums.sort(function(a, b) { return a.priority - b.priority; });
            for (let forum of group.forums) {
                if (forum.subforums)
                    forum.subforums.sort(function(a, b) { return a.priority - b.priority; });
            }
        }

        returndata(senddat);
    }).catch(e => returndata(e));
}