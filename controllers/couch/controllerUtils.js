let configs = require("../../config/config.js");
let request = require("request-promise-native");

exports.urlstart = configs.configs.dburl + "/" + configs.configs.dbname;
exports.designdoc = "/_design/forumdoc";
exports.authstring = configs.configs.dbuser + ":" + configs.configs.dbpass;

exports.totalAuthString = "Basic " + Buffer.from(exports.authstring).toString("base64");

let testTitleRegex = /[^a-z0-9!?%$#@&*-_/\\ ]/gi

exports.quickErrorReturn = function(e, res) {
    console.log(e.message);
    // do something with the response
    res.send('{"error": "An error occured between the server and the database."}');
}

exports.makeKebab = function(str) {
    return str.replace(/\s+/g, '-').replace(/[?&%$#@^*/\\]/,'').toLowerCase();
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
                }).then(response => {
                    if (response.statusCode == 409) {
                        // db conflict, retry from start
                        exports.incrementThreadPosts(threadid, newdate);
                    }
                }).catch(e => console.log(e.message));
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
                }).then(response => {
                    if (response.statusCode == 409) {
                        // db conflict, retry from start
                        exports.incrementForumPosts(forumid);
                    }
                }).catch(e => console.log(e.message));
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
                }).then(response => {
                    if (response.statusCode == 409) {
                        // db conflict, retry from start
                        exports.incrementThreadViews(threadid, newdate);
                    }
                }).catch(e => console.log(e.message));
            }
        }
    }).catch(e => console.log(e.message));
}

exports.incrementForumThreads = function(forumid) {
    // get the thread, send it back with posts + 1, retry function if conflict
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
                forum.threadNum++;
                request({
                    method: "PUT",
                    uri: exports.urlstart + "/" + forumdbid,
                    headers: { Authorization: exports.totalAuthString },
                    body: JSON.stringify(forum),
                    resolveWithFullResponse: true
                }).then(response => {
                    if (response.statusCode == 409) {
                        // db conflict, retry from start
                        exports.incrementForumThreads(forumid);
                    }
                }).catch(e => console.log(e.message));
            }
        }
    }).catch(e => console.log(e.message));
}
