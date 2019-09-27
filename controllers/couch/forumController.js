let utils = require("./controllerUtils");
let request = require("request-promise-native");

exports.getForumData = function(data, session, returndata) {
    Promise.all([
        request({
            method: "GET",
            uri: utils.urlstart + utils.designdoc + "/_view/forums-by-parent",
            headers: { Authorization: utils.totalAuthString },
            json: true
        }),
        request({
            method: "GET",
            uri: utils.urlstart + utils.designdoc + '/_view/threads-by-parent?key="' + data.forum + '"',
            headers: { Authorization: utils.totalAuthString },
            json: true
        })
    ]).then(promisevalues => {
        let [jfData, jdat] = promisevalues;
        let allforums = {};
        let returnData = { id: data.forum, threads: [], subforums: [], crumbs: [] };

        for (let row of jfData.rows) {
            let value = row.value;
            allforums[value.id] = value;
            if (value.id == returnData.id) {
                returnData.title = value.title;
            }
            if (value.parent == returnData.id) {
                returnData.subforums.push({ 
                    title: value.title,
                    id: value.id,
                    posts: value.posts,
                    threadnum: value.threadnum,
                    subforums: []
                });
            }
        }

        // search through each subforum and each other forum, see if they are related
        for (let sub of returnData.subforums) {
            let keys = Object.keys(allforums);
            for (let key of keys) {
                if (allforums[key].parent == sub.id) {
                    sub.subforums.push({
                        id: key,
                        title: allforums[key].title
                    });
                }
            }
            // delete empty arrays
            if (sub.subforums.length == 0) {
                delete sub.subforums;
            }
        }
        if (returnData.subforums.length == 0) {
            delete returnData.subforums;
        }

        // add all crumbs
        if (!allforums[returnData.id].top) {
            returnData.crumbs.push({
                id: allforums[returnData.id].parent,
                title: allforums[allforums[returnData.id].parent].title
            });
            while (!allforums[returnData.crumbs[0].id].top) {
                returnData.crumbs.unset({
                    id: allforums[returnData.crumbs[0].id].parent,
                    title: allforums[allforums[returnData.crumbs[0].id].parent].title
                });
            }
        }

        for (let row of jdat.rows) {
            let value = row.value;
            returnData.threads.push({
                title: value.title,
                id: value.id,
                posts: value.posts,
                views: value.views,
                last: value.last,
                date: value.date
            })
        }
        // sort all subforums, sub-subforums, and threads
        if (returnData.subforums) {
            returnData.subforums.sort(function(a, b) { return a.priority = b.priority; });
            for (let sub of returnData.subforums) {
                if (sub.subforums) {
                    sub.sort(function(a, b) { return a.priority = b.priority; });
                }
            }
        }
        returnData.threads.sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime()});

        returndata(returnData);

    }).catch(e => quickErrorResponse(e, returndata));
}

exports.makeThread = function(data, session, returndata) {
    // check the user, check title and post formats, build thread and post objects, add both
    if (session.user) {
        if (data && data.text && typeof data.text == "string" && data.text.length > 0) {
            if (data.title && typeof data.title == "string" && data.title.length > 0) {
                if (testTitleRegex.test(data.title)) {
                    returndata({error: "Invalid characters in title"});
                    return;
                }
                let isgamethread = false;
                if (data.isGame) isgamethread = true;
                // TODO: verify forum exists
                let threadid = makeKebab(data.title);
                let thisTime = new Date().toISOString();
                let threaddata = {
                    type: "thread",
                    parent: data.forum,
                    title: data.title,
                    id: threadid,
                    user: session.user.name,
                    posts: 1,
                    views: 1,
                    last: session.user.name,
                    date: thisTime,
                    isGame: isgamethread
                }
                let postdata = {
                    type: "post",
                    parent: threadid,
                    header: {
                        name: session.user.name,
                        date: thisTime
                    }, 
                    textBlock: {
                        text: data.text
                    }
                }

                // check if the parent forum exists and the thread id doesn't
                Promise.all([
                    request({
                        method: "GET",
                        uri: utils.urlstart + utils.designdoc + '/_view/doc-by-id?key="' + threadid + '"',
                        headers: { Authorization: utils.totalAuthString },
                        json: true
                    }),
                    request({
                        method: "GET",
                        uri: utils.urlstart + utils.designdoc + '/_view/doc-by-id?key="' + data.forum + '"',
                        headers: { Authorization: utils.totalAuthString },
                        json: true
                    })
                ]).then(values => {
                    let [threaddocs, forumdocs] = values;
                    let threadexists = false;
                    let forumexists = false;
                    for (let row of threaddocs.rows) {
                        if (row.value.type == 'thread') threadexists = true;
                    }
                    if (threadexists) {
                        returndata({error: "That thread already exists!"});
                        return;
                    }
                    for (let row of forumdocs.rows) {
                        if (row.value.type == 'forum') forumexists = true;
                    }
                    if (!forumexists) {
                        returndata({error: "Parent forum does not exist"});
                        return;
                    }

                    if (data.text.length > 10000) { //TODO: make this some kind of global or config
                        returndata({error: "Attached text is too long"});
                    } else {
                        // create the thread!
                        Promise.all([
                            request({
                                method: "POST",
                                uri: utils.urlstart,
                                headers: { Authorization: utils.totalAuthString, "Content-Type": "application/json" },
                                body: JSON.stringify(postdata),
                                resolveWithFullResponse: true
                            }),
                            request({
                                method: "POST",
                                uri: utils.urlstart,
                                headers: { Authorization: utils.totalAuthString, "Content-Type": "application/json" },
                                body: JSON.stringify(threaddata),
                                resolveWithFullResponse: true
                            })
                        ]).then(responses => {
                            let [postresponse, threadresponse] = responses;
                            if (postresponse.statusCode > 300 || threadresponse.statusCode > 300) {
                                returndata({ error: 'Thread creation could not be completed at this time'});
                            } else {
                                utils.incrementForumPosts(data.forum);
                                utils.incrementForumThreads(data.forum);
                                returndata({status: "Success!", threadid: threadid});
                            }
                        }).catch(e => quickErrorReturn(e, res));
                    }

                }).catch(e => quickErrorReturn(e,res));
            } else {
                returndata({error: "Attached title must be a string object"});
            }
        } else {
            returndata({error: "Attached text must be a string object"});
        }
    } else {
        returndata({ error: "You are not logged in!"})
    }
}