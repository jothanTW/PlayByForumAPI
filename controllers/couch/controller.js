let configs = require("../../config/config.js");
let http = require("http");
let request = require("request-promise-native");

const urlstart = configs.configs.dburl + "/" + configs.configs.dbname;
const designdoc = "/_design/forumdoc";
const authstring = configs.configs.dbuser + ":" + configs.configs.dbpass;

const totalAuthString = "Basic " + Buffer.from(authstring).toString("base64");

let testTitleRegex = /[^a-z0-9!?%$#@&*-_/\\ ]/gi

function quickErrorReturn(e, res) {
    console.log(e);
    // do something with the response
    res.send('{"error": "An error occured between the server and the database."}');
}

function makeKebab(str) {
    return str.replace(/\s+/g, '-').replace(/[?&%$#@^*/\\]/,'').toLowerCase();
}

function incrementThreadPosts(threadid) {
    // get the thread, send it back with posts + 1, retry function if conflict
    request({
        method: "GET",
        uri: urlstart + designdoc + '/_view/doc-by-id?key="' + threadid + '"',
        headers: { Authorization: totalAuthString },
        json: true
    }).then(doc =>{
        for (let row of doc.rows) {
            if (row.value.type = "thread") {
                let thread = Object.assign({}, row.value);
                let threaddbid = thread._id;
                delete thread._id;
                thread.posts++;
                request({
                    method: "PUT",
                    uri: urlstart + "/" + threaddbid,
                    headers: { Authorization: totalAuthString },
                    body: thread,
                    json: true
                }).then(response => {
                    if (response.statusCode == 409) {
                        // db conflict, retry from start
                        incrementThreadPosts(threadid);
                    }
                }).catch(e => console.log(e));
            }
        }
    }).catch(e => console.log(e));
}

function incrementForumPosts(forumid) {
    // get the thread, send it back with posts + 1, retry function if conflict
    request({
        method: "GET",
        uri: urlstart + designdoc + '/_view/doc-by-id?key="' + forumid + '"',
        headers: { Authorization: totalAuthString },
        json: true
    }).then(doc =>{
        for (let row of doc.rows) {
            if (row.value.type = "forum") {
                let forum = Object.assign({}, row.value);
                let forumdbid = forum._id;
                delete forum._id;
                forum.posts++;
                request({
                    method: "PUT",
                    uri: urlstart + "/" + forumdbid,
                    headers: { Authorization: totalAuthString },
                    body: forum,
                    json: true
                }).then(response => {
                    if (response.statusCode == 409) {
                        // db conflict, retry from start
                        incrementForumPosts(forumid);
                    }
                }).catch(e => console.log(e));
            }
        }
    }).catch(e => console.log(e));
}

function incrementForumThreads(forumid) {
    // get the thread, send it back with posts + 1, retry function if conflict
    request({
        method: "GET",
        uri: urlstart + designdoc + '/_view/doc-by-id?key="' + forumid + '"',
        headers: { Authorization: totalAuthString },
        json: true
    }).then(doc =>{
        for (let row of doc.rows) {
            if (row.value.type = "forum") {
                let forum = Object.assign({}, row.value);
                let forumdbid = forum._id;
                delete forum._id;
                forum.threadNum++;
                request({
                    method: "PUT",
                    uri: urlstart + "/" + forumdbid,
                    headers: { Authorization: totalAuthString },
                    body: forum,
                    json: true
                }).then(response => {
                    if (response.statusCode == 409) {
                        // db conflict, retry from start
                        incrementForumThreads(forumid);
                    }
                }).catch(e => console.log(e));
            }
        }
    }).catch(e => console.log(e));
}

exports.getGroupsData = function(req, res) {
    let geturl = urlstart + designdoc + "/_view/groups-and-forums";
    request({
        method: "GET",
        uri: urlstart + designdoc + "/_view/groups-and-forums",
        headers: { Authorization: totalAuthString },
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

        res.send(senddat);
    }).catch(e => quickErrorReturn(e, res));
}

exports.getForumData = function(req, res) {
    Promise.all([
        request({
            method: "GET",
            uri: urlstart + designdoc + "/_view/forums-by-parent",
            headers: { Authorization: totalAuthString },
            json: true
        }),
        request({
            method: "GET",
            uri: urlstart + designdoc + '/_view/threads-by-parent?key="' + req.params.forum + '"',
            headers: { Authorization: totalAuthString },
            json: true
        })
    ]).then(promisevalues => {
        let [jfData, jdat] = promisevalues;
        let allforums = {};
        let returnData = { id: req.params.forum, threads: [], subforums: [], crumbs: [] };

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

        res.send(returnData);

    }).catch(e => quickErrorReturn(e, res));
}

exports.makeThread = function(req, res) {
    // check the user, check title and post formats, build thread and post objects, add both
    if (req.session.user) {
        if (req.body && req.body.text && typeof req.body.text == "string" && req.body.text.length > 0) {
            if (req.body.title && typeof req.body.title == "string" && req.body.title.length > 0) {
                if (testTitleRegex.test(req.body.title)) {
                    res.send({error: "Invalid characters in title"});
                    return;
                }
                // TODO: verify forum exists
                let threadid = makeKebab(req.body.title);
                let thisTime = new Date().toISOString();
                console.log(threadid);
                let threaddata = {
                    type: "thread",
                    parent: req.params.forum,
                    title: req.body.title,
                    id: threadid,
                    user: req.session.user.name,
                    posts: 1,
                    views: 1,
                    last: req.session.user.name,
                    date: thisTime
                }
                let postdata = {
                    type: "post",
                    parent: threadid,
                    header: {
                        name: req.session.user.name,
                        date: thisTime
                    }, 
                    textBlock: {
                        text: req.body.text
                    }
                }

                // check if the parent forum exists and the thread id doesn't
                Promise.all([
                    request({
                        method: "GET",
                        uri: urlstart + designdoc + '/_view/doc-by-id?key="' + threadid + '"',
                        headers: { Authorization: totalAuthString },
                        json: true
                    }),
                    request({
                        method: "GET",
                        uri: urlstart + designdoc + '/_view/doc-by-id?key="' + req.params.forum + '"',
                        headers: { Authorization: totalAuthString },
                        json: true
                    })
                ]).then(values => {
                    console.log(values);
                    let [threaddocs, forumdocs] = values;
                    let threadexists = false;
                    let forumexists = false;
                    for (let row of threaddocs.rows) {
                        if (row.value.type == 'thread') threadexists = true;
                    }
                    if (threadexists) {
                        res.send({error: "That thread already exists!"});
                        return;
                    }
                    for (let row of forumdocs.rows) {
                        if (row.value.type == 'forum') forumexists = true;
                    }
                    if (!forumexists) {
                        res.send({error: "Parent forum does not exist"});
                        return;
                    }

                    if (req.body.text.length > 10000) { //TODO: make this some kind of global or config
                        res.send({error: "Attached text is too long"});
                    } else {
                        // create the thread!
                        Promise.all([
                            request({
                                method: "POST",
                                uri: urlstart,
                                headers: { Authorization: totalAuthString, "Content-Type": "application/json" },
                                body: JSON.stringify(postdata),
                                resolveWithFullResponse: true
                            }),
                            request({
                                method: "POST",
                                uri: urlstart,
                                headers: { Authorization: totalAuthString, "Content-Type": "application/json" },
                                body: JSON.stringify(threaddata),
                                resolveWithFullResponse: true
                            })
                        ]).then(responses => {
                            let [postresponse, threadresponse] = responses;
                            if (postresponse.statusCode > 300 || threadresponse.statusCode > 300) {
                                res.send({ error: 'Thread creation could not be completed at this time'});
                            } else {
                                res.send({status: "Success!", threadid: threadid});
                            }
                        }).catch(e => quickErrorReturn(e, res));
                    }

                }).catch(e => quickErrorReturn(e,res));
            } else {
                res.send({error: "Attached title must be a string object"});
            }
        } else {
            res.send({error: "Attached text must be a string object"});
        }
    } else {
        res.send({ error: "You are not logged in!"})
    }
}

exports.setThreadStats = function(req, res) {
    let getstaturl = urlstart + designdoc + "/_view/single-thread-stats";
    let posturl = urlstart + "/";

    // get each thread block, copy over the posts, last, and last date values, make sure the views value exists
    http.get(getstaturl, {auth: authstring}, rsp => {
        let rtData = '';
        rsp.on('data', d => rtData += d);
        rsp.on('end', () => {
            let jtData = JSON.parse(rtData).rows[0].value;
            let upNum = 0;

            let keys = Object.keys(jtData);
            for (let key of keys) {
                let tdata = jtData[key];
                let senddat = Object.assign({}, tdata.thread);
                let doSend = false;
                if (tdata.posts != senddat.posts) {
                    senddat.posts = tdata.posts;
                    doSend = true;
                }
                if (tdata.last != senddat.last) {
                    senddat.last = tdata.last;
                    doSend = true;
                } 
                if (tdata.date != senddat.date) {
                    senddat.date = tdata.date;
                    doSend = true;
                }
                if (!(tdata.thread.views > -1)) {
                    senddat.views = 0;
                    doSend = true;
                }

                if (doSend) {
                    console.log("Updating counts for thread " + senddat.title + "...");
                    upNum++;
                    let prequest = http.request(posturl + senddat._id + "/", {auth: authstring, method: "PUT"}, rsp3 => {
                        if (rsp3.statusCode >= 400) {
                            console.log("update for thread " + senddat.title + " failed with status code " + rsp3.statusCode);
                        } else {
                            console.log("update for thread " + senddat.title + " complete.");
                        }
                    }).on('error', quickErrorReturn);
                    delete senddat._id;
                    prequest.write(JSON.stringify(senddat));
                    prequest.end();
                }
            }

            if (upNum == 0) {
                console.log("All threads up to date");
            }

            res.send('{ "updatedThreads" : ' + upNum + ' }');
        });
    }).on('error', quickErrorReturn);
}

exports.setForumStats = function(req, res) {
    let geturl = urlstart + designdoc + "/_view/forums-by-parent";
    let getstaturl = urlstart + designdoc + "/_view/single-thread-stats";
    let posturl = urlstart + "/";

    console.log("Setting forum stats...");

    // get each forum and thread stat block
    http.get(geturl, {auth: authstring}, rsp => {
        let rtData = '';
        rsp.on('data', d => rtData += d);
        rsp.on('end', () => {
            let jtData = JSON.parse(rtData);
            http.get(getstaturl, {auth: authstring}, rsp2 => {
                let rsData = '';
                rsp2.on('data', d => rsData += d);
                rsp2.on('end', () => {
                    let jsData = JSON.parse(rsData);

                    console.log("threadcount: fetched " + jtData.rows.length + " forums and " + jsData.rows.length + " threads");

                    // set each thread to 0
                    let forums = {};
                    let fmetas = {};
                    for (let row of jtData.rows) {
                        let f = Object.assign({}, row.value);
                        fmetas[f.id] = { threadnum: f.threadnum, posts: f.posts };
                        f.threadnum = 0;
                        f.posts = 0;
                        forums[f.id] = f;
                    }
                    // go through each thread stat block, adding stats to its parent
                    let threadkeys = Object.keys(jsData.rows[0].value);
                    for (let threadkey of threadkeys) {
                        let s = jsData.rows[0].value[threadkey];
                        if (forums[s.thread.parent]) {
                            forums[s.thread.parent].threadnum++;
                            forums[s.thread.parent].posts += s.posts;
                        }
                    }
                    // all threads should be updated. send them back if they're changed.

                    let upNum = 0;

                    let keys = Object.keys(forums);
                    for (let key of keys) {
                        if (forums[key].threadnum != fmetas[key].threadnum || forums[key].posts != fmetas[key].posts) {
                            console.log("Updating counts for forum " + forums[key].title + "...");
                            upNum++;
                            let prequest = http.request(posturl + forums[key]._id + "/", {auth: authstring, method: "PUT"}, rsp3 => {
                                if (rsp3.statusCode >= 400) {
                                    console.log("update for forum " + forums[key].title + " failed with status code " + rsp3.statusCode);
                                } else {
                                    console.log("update for forum " + forums[key].title + " complete.");
                                }
                            }).on('error', quickErrorReturn);
                            delete forums[key]._id;
                            prequest.write(JSON.stringify(forums[key]));
                            prequest.end();
                        }
                    }

                    if (upNum == 0) {
                        console.log("All forums up to date");
                    }

                    res.send('{ "updatedForums" : ' + upNum + ' }');

                });
            }).on('error', quickErrorReturn);
        });
    }).on('error', quickErrorReturn);
}

exports.makePost = function(req, res) {
    // check the user, check some post formats, build post object, add to db
    if (req.session.user) {
        // TODO: Verify thread exists
        if (req.body && req.body.text && typeof req.body.text == "string" && req.body.text.length > 0) {
            // we have been given a user and we're assumed to have a date available, which is all we need for the header  
            let postdata = {
                type: "post",
                parent: req.params.thread,
                header: {
                    name: req.session.user.name,
                    date: new Date().toISOString()
                }, 
                textBlock: {
                    text: req.body.text
                }
            }

            if (req.body.text.length > 10000) { //TODO: make this some kind of global or config
                res.send({error: "Attached text is too long"});
            } else {
                // send that post!
                request({
                    method: "POST",
                    uri: urlstart,
                    headers: { Authorization: totalAuthString, "Content-Type": "application/json" },
                    body: JSON.stringify(postdata),
                    resolveWithFullResponse: true
                }).then(response => {
                    if (response.statusCode > 300) {
                        res.send({ error: 'Post creation could not be completed at this time'});
                    } else {
                        postdata.status = "Post created!"
                        // increment the thread post count
                        incrementThreadPosts(req.params.thread);
                        // can't do this until we have the parent     incrementForumPosts()
                        // send back the post
                        res.send(postdata);
                    }
                }).catch(e => quickErrorReturn(e, res));
            }

        } else {
            res.send({error: "Attached text must be a string object"});
        }

    } else {
        res.send({ error: "You are not logged in!"})
    }
}

exports.getThreadData = function(req, res) {
    // get this thread, its posts, and all forums (to build crumbs)
    let pge = 1;
    if (req.params.page) pge = req.params.page;
    if (pge == "last")
    {
        // normally, get the last page
        // I don't know how to do that right now
        pge = 1;
    }
    let skipnum = 40 * (pge - 1);
    if (skipnum < 0) skipnum = 0;
    Promise.all([
        request({
            method: "GET",
            uri: urlstart + designdoc + '/_view/doc-by-id?key="' + req.params.thread + '"',
            headers: { Authorization: totalAuthString },
            json: true
        }),
        request({
            method: "GET",
            uri: urlstart + designdoc + '/_view/posts-by-thread-and-date?startkey=["' + req.params.thread + '", "0"]&endkey=["' + req.params.thread + '", "9999-99-99T99:99:99.999Z"]&limit=40&skip=' + skipnum,
            headers: { Authorization: totalAuthString },
            json: true
        }),
        request({
            method: "GET",
            uri: urlstart + designdoc + "/_view/forums-by-parent",
            headers: { Authorization: totalAuthString },
            json: true
        })
    ]).then(promisevalues => {
        let [threads, posts, forums] = promisevalues;
        let thread = threads.rows[0].value;
        let returnData = {
            id: req.params.thread,
            title: thread.title,
            isGame: thread.isGame,
            postNum: thread.posts,
            posts: [],
            crumbs: []
        }
        for (let row of posts.rows) {
            let pdat = {
                header: row.value.header,
                textBlock: row.value.textBlock
            };
            if (row.value.edit)
                pdat.edit = row.value.edit;
            
            returnData.posts.push(pdat);
        }

        let lastCrumb = {};

        for (let row of forums.rows) {
            if (row.value.id == thread.parent) {
                lastCrumb = row.value;
                returnData.crumbs.push({
                    title: row.value.title,
                    id: row.value.id
                })
            }
        }

        let maxcrumbs = 10;

        while (!lastCrumb.top && maxcrumbs > 0) {
            for (let row of forums.rows) {
                if (row.value.id == lastCrumb.parent) {
                    lastCrumb = row.value;
                    maxcrumbs--;
                    returnData.crumbs.unshift({
                        title: row.value.title,
                        id: row.value.id
                    })
                }
            }
        }

        // TODO: get the posts's users and characters from the db, and build the headers properly

        res.send(returnData);
    }).catch(e => quickErrorReturn(e, res));
}