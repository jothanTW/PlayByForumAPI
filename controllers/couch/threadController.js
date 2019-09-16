let configs = require("../../config/config.js");
let http = require("http");
let request = require("request-promise-native");

const urlstart = configs.configs.dburl + "/" + configs.configs.dbname;
const designdoc = "/_design/forumdoc";
const authstring = configs.configs.dbuser + ":" + configs.configs.dbpass;

const totalAuthString = "Basic " + Buffer.from(authstring).toString("base64");

function makeKebab(str) {
    let rstr = str.replace(/\s+/g, '-').toLowerCase();
}

function quickErrorReturn(e, res) {
    console.log(e.message);
    // do something with the response
    res.send('{"error": "An error occured between the server and the database."}');
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