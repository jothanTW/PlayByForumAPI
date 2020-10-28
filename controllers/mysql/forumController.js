let utils = require("./controllerUtils");
let request = require("request-promise-native");

let Thread = require("../../models/thread");

let msqlcon = utils.connection;

exports.getForumData = function(data, session, returndata) {
    utils.getForumHierarchy(groups => {
            
        let returnData = { id: data.forum, threads: [], subforums: [], crumbs: [] };
        let thisForumData = getForumFromHierarchy(groups, data.forum);

        if (!thisForumData) {
            returndata({error: "The specified forum could not be found"});
            return;
        }

        msqlcon.query("select threads.pkey, threads.id, threads.name, threads.parent, threads.is_game_thread, " +
                        "threads.views, pcount post_count, posts.post_date last_post_date, " +
                        "(select userid from users where users.pkey = posts.user) last_poster, " +
                        "(select userid from users where users.pkey = threads.owner) owner " +
                    "from threads " +
                    "left join (select posts.parent as parkey, count(*) pcount, max(num) lpid from posts group by parkey) pdata on pdata.parkey = threads.pkey " +
                    "left join posts on pdata.lpid = posts.num and posts.parent = threads.pkey where threads.parent = ?;", [thisForumData.dbid], (e, r, f) => {
            if (e) {
                console.log(e);
                returndata({error: "There was a server error fetching the forum"});
                return;
            }
            returnData.subforums = thisForumData.subforums;
            returnData.crumbs = thisForumData.crumbs;
            returnData.title = thisForumData.name;
            
            for (let i = 0; i < r.length; i++) {
                let newThread = new Thread(r[i].id, r[i].name, r[i].owner, 
                    thisForumData.crumbs[0].id, r[i].post_count, r[i].views, r[i].is_game_thread == 1);
                newThread.last_post_time = r[i].last_post_date;
                newThread.last_poster = r[i].last_poster;
                returnData.threads.push(newThread);
            }

            // reverse the crumbs
            returnData.crumbs.reverse();

            // alternatively, return thisForumData after adding threads

            returndata(returnData);
        });
    });
}

function getForumFromHierarchy(groupdata, id) {
    for (let i = 0; i < groupdata.length; i++) {
        let g = groupdata[i];
        for (let j = 0; j < g.forums.length; j++) {
            let f = getForumFromHierarchyR(g.forums[j], id);
            if (f) {
                f.crumbs.push({id: g.forums[j].id, title: g.forums[j].name});
                //f.crumbs.push({id: g.id, title: g.name});
                return f;
            }
        }
    }
    return null;
}

function getForumFromHierarchyR(forum, id) {
    if (forum.id == id) {
        forum.crumbs = [];
        return forum;
    } else {
        for (let i = 0; i < forum.subforums.length; i++) {
            let f = getForumFromHierarchyR(forum.subforums[i], id);
            if (f) {
                //f.crumbs.push({id: forum.subforums[i].id, title: forum.subforums[i].name});
                return f;
            }
        }
    }
    return null;
}

exports.makeThread = function(data, session, returndata) {
    if (session.user) {
        if (data && data.text && typeof data.text == "string" && data.text.length > 0) {
            if (data.title && typeof data.title == "string" && data.title.length > 0) {
                if (utils.testTitleRegex.test(data.title)) {
                    returndata({error: "Invalid characters in title"});
                    return;
                }
                let isgamethread = false;
                if (data.isGame) isgamethread = true;
                let threadid = utils.makeKebab(data.title);
                let thisTime = new Date().toISOString();

                // look for the forum and any existing threads
                // this should be a transaction

                // IN CASE OF DUPLICATE THREAD IDS
                // thread ids are all stored in a modified camel case; as:
                //      thread-title-here~12
                // which indicates the twelfth thread with id thread-title-here
                msqlcon.getConnection((conerr, connection) => {
                    if (conerr) throw conerr;
                    connection.beginTransaction(transactionErr => {
                        if (transactionErr) throw transactionErr;
                        connection.query("select pkey, id, name, 'THREAD' type from threads where id like ? union select pkey, id, name, 'FORUM' type from forums where id = ?;",
                            [data.title + '%', data.forum], (selerr, selret, f) => {
                            if (selerr) throw selerr;
                            let datfound = -1;
                            let maxUThreadNum = 1;
                            for (let i = 0; i < selret.length; i++) {
                                if (selret[i].type == 'FORUM') {
                                    datfound = selret[i].pkey;
                                } else if (selret[i].type == 'THREAD') {
                                    let threaditer = selret[i].id.substring(selret[i].id.indexOf('~') + 1);
                                    // if this isn't a number something's gone wrong
                                    let threaditerint = parseInt(threaditer);
                                    if (maxUThreadNum < threaditerint) maxUThreadNum = threaditerint;
                                }

                                if (datfound == -1) {
                                    returndata({error: "Specified forum does not exist"});
                                    return;
                                }

                                let newThreadId = threadid + "~" + (maxUThreadNum++);

                                let threadArgs = [newThreadId, data.title, datfound, isgamethread ? '1' : '0', session.user.dbid];
                                let postArgs = [0, 1, session.user.dbid, data.text];

                                connection.query("insert into threads (id, name, parent, is_game_thread, owner) values (?, ?, ?, ?, ?)", threadArgs, (tinserr, tinsret, f) => {
                                    if (tinserr) {
                                        connection.rollback(err => {
                                            if (err) throw err;
                                            throw tinserr;
                                        });
                                        return;
                                    }
                                    let threadpkey = tinsret.insertId;
                                    postArgs[0] = threadpkey;
                                    connection.query("insert into posts (parent, num, user, content) values (?, ?, ?, ?)", postArgs, (perr, pret, f) => {
                                        if (perr) {
                                            connection.rollback(err => {
                                                if (err) throw err;
                                                throw perr;
                                            });
                                            return;
                                        }
                                        // we made it!
                                        connection.commit(cerr => {
                                            if (cerr) {
                                                connection.rollback(err => {
                                                    if (err) throw err;
                                                    throw cerr;
                                                });
                                                return;
                                            }
                                            returndata({status: "GOOD", threadid: newThreadId});
                                        })
                                    });
                                });
                            }
                        });
                    })
                });
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

exports.makeThread2 = function(data, session, returndata) {
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