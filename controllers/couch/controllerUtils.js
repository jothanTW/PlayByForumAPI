let configs = require("../../config/config.js");
let request = require("request-promise-native");

exports.urlstart = configs.dburl + "/" + configs.dbname;
exports.designdoc = "/_design/forumdoc";
exports.authstring = configs.dbuser + ":" + configs.dbpass;

exports.totalAuthString = "Basic " + Buffer.from(exports.authstring).toString("base64");
exports.minSalt = 64;

let testTitleRegex = /[^a-z0-9!?%$#@&*-_/\\ ]/gi

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
    return str.replace(/\s+/g, '-').replace(/[?&%$#@^*/\\]/,'').toLowerCase();
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



exports.incrementThreadPosts = function(threadid, newdate, lastposter) {
    let newLastDate = new Date().toISOString();
    if (newdate) newLastDate = newdate;
    // get the thread, send it back with posts + 1, retry function if conflict
    request({
        method: "GET",
        uri: exports.urlstart + exports.designdoc + '/_view/doc-by-id?key="' + threadid + '"',
        headers: { Authorization: exports.totalAuthString },
        json: true
    }).then(doc =>{
        for (let row of doc.rows) {
            if (row.value.type = "thread") {
                let thread = Object.assign({}, row.value);
                let threaddbid = thread._id;
                delete thread._id;
                thread.posts++;
                if (lastposter && new Date(thread.date).getTime() < new Date(newLastDate).getTime()) {
                    thread.last = lastposter;
                    thread.date = newLastDate;
                }
                request({
                    method: "PUT",
                    uri: exports.urlstart + "/" + threaddbid,
                    headers: { Authorization: exports.totalAuthString },
                    body: JSON.stringify(thread),
                    resolveWithFullResponse: true
                }).catch(e => {
                    if (e.statusCode == 409)
                        exports.incrementThreadPosts(threadid);
                    else
                        console.log("Error in Thread Posts Increment: " + e.message);
                });
            }
        }
    }).catch(e => console.log(e.message));
}

exports.incrementForumPosts = function(forumid) {
    // get the forum, send it back with posts + 1, retry function if conflict
    request({
        method: "GET",
        uri: exports.urlstart + exports.designdoc + '/_view/doc-by-id?key="' + forumid + '"',
        headers: { Authorization: exports.totalAuthString },
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
                    uri: exports.urlstart + "/" + forumdbid,
                    headers: { Authorization: exports.totalAuthString },
                    body: JSON.stringify(forum),
                    resolveWithFullResponse: true
                }).catch(e => {
                    if (e.statusCode == 409)
                        exports.incrementForumPosts(forumid);
                    else
                        console.log("Error in Forum Posts Increment: " + e.message);
                });
            }
        }
    }).catch(e => console.log(e.message));
}

exports.incrementThreadViews = function(threadid) {
    // get the thread, send it back with views + 1, retry function if conflict
    request({
        method: "GET",
        uri: exports.urlstart + exports.designdoc + '/_view/doc-by-id?key="' + threadid + '"',
        headers: { Authorization: exports.totalAuthString },
        json: true
    }).then(doc =>{
        for (let row of doc.rows) {
            if (row.value.type = "thread") {
                let thread = Object.assign({}, row.value);
                let threaddbid = thread._id;
                delete thread._id;
                thread.views++
                request({
                    method: "PUT",
                    uri: exports.urlstart + "/" + threaddbid,
                    headers: { Authorization: exports.totalAuthString },
                    body: JSON.stringify(thread),
                    resolveWithFullResponse: true
                }).catch(e => {
                    if (e.statusCode == 409)
                        exports.incrementThreadViews(threadid);
                    else
                        console.log("Error in Thread View Increment: " + e.message);
                });
            }
        }
    }).catch(e => console.log(e.message));
}

exports.incrementForumThreads = function(forumid) {
    // get the forum, send it back with threads + 1, retry function if conflict
    request({
        method: "GET",
        uri: exports.urlstart + exports.designdoc + '/_view/doc-by-id?key="' + forumid + '"',
        headers: { Authorization: exports.totalAuthString },
        json: true
    }).then(doc =>{
        for (let row of doc.rows) {
            if (row.value.type = "forum") {
                let forum = Object.assign({}, row.value);
                let forumdbid = forum._id;
                delete forum._id;
                forum.threadnum++;
                request({
                    method: "PUT",
                    uri: exports.urlstart + "/" + forumdbid,
                    headers: { Authorization: exports.totalAuthString },
                    body: JSON.stringify(forum),
                    resolveWithFullResponse: true
                }).catch(e => {
                    if (e.statusCode == 409)
                        exports.incrementForumThreads(forumid);
                    else
                        console.log("Error in Forum Thread Increment: " + e.message);
                });
            }
        }
    }).catch(e => console.log(e.message));
}
