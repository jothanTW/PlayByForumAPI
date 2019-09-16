let configs = require("../../config/config.js");
let request = require("request-promise-native");

exports.urlstart = configs.configs.dburl + "/" + configs.configs.dbname;
exports.designdoc = "/_design/forumdoc";
exports.authstring = configs.configs.dbuser + ":" + configs.configs.dbpass;

exports.totalAuthString = "Basic " + Buffer.from(authstring).toString("base64");

let testTitleRegex = /[^a-z0-9!?%$#@&*-_/\\ ]/gi

exports.quickErrorReturn = function(e, res) {
    console.log(e);
    // do something with the response
    res.send('{"error": "An error occured between the server and the database."}');
}

exports.makeKebab = function(str) {
    return str.replace(/\s+/g, '-').replace(/[?&%$#@^*/\\]/,'').toLowerCase();
}



exports.incrementThreadPosts = function(threadid) {
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
                    resolveWithFullResponse: true
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

exports.incrementForumPosts = function(forumid) {
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
                    resolveWithFullResponse: true
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

exports.incrementForumThreads = function(forumid) {
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
                    resolveWithFullResponse: true
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
