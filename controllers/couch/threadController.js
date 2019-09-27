let utils = require("./controllerUtils");
let request = require("request-promise-native");

exports.makePost = function(data, session, returndata) {
    console.log("Making Post");
    // check the user, check some post formats, build post object, add to db
    if (session.user) {
        // TODO: Verify thread exists
        if (data && data.text && typeof data.text == "string" && data.text.length > 0) {
            // we have been given a user and we're assumed to have a date available, which is all we need for the header  
            let postdata = {
                type: "post",
                parent: data.thread,
                header: {
                    name: session.user.name,
                    date: new Date().toISOString()
                }, 
                textBlock: {
                    text: data.text
                }
            }

            if (data.alias) {
                if (typeof data.alias != "string") {
                    returndata({error: "alias is not a string!"});
                } else if (data.alias.length > 0) {
                    postdata.header.alias = data.alias;
                }
            }

            if (data.ooc && typeof data.ooc != "string") {
                returndata({error: "OOC text is not a string!"});
                return;
            }

            if (data.ooc) {
                postdata.textBlock.ooc = data.ooc;
            }

            request({
                method: "GET",
                uri: utils.urlstart + utils.designdoc + '/_view/doc-by-id?key="' + data.thread + '"',
                headers: { Authorization: utils.totalAuthString },
                json: true
            }).then(threads =>  {
                let threadfound = {};
                
                for (let row of threads.rows) {
                    if (row.value.type == 'thread') threadfound = row.value;
                }
                if (threadfound.parent) {
                    if (data.text.length > 10000) { //TODO: make this some kind of global or config
                        returndata({error: "Attached text is too long"});
                    } else {
                        // send that post!
                        request({
                            method: "POST",
                            uri: utils.urlstart,
                            headers: { Authorization: utils.totalAuthString, "Content-Type": "application/json" },
                            body: JSON.stringify(postdata),
                            resolveWithFullResponse: true
                        }).then(response => {
                            if (response.statusCode > 300) {
                                returndata({ error: 'Post creation could not be completed at this time'});
                            } else {
                                postdata.status = "Post created!"
                                // increment the thread post count
                                utils.incrementThreadPosts(data.thread, postdata.header.date, session.user.name);
                                utils.incrementForumPosts(threadfound.parent);
                                // send back the post
                                returndata(postdata);
                            }
                        }).catch(e => utils.quickErrorResponse(e, returndata));
                    }
                } else {
                    returndata({error: "Specified thread does not exist"})
                }
            }).catch(e => utils.quickErrorResponse(e, returndata));

            

        } else {
            returndata({error: "Attached text must be a string object"});
        }

    } else {
        returndata({ error: "You are not logged in!"})
    }
}

exports.getThreadData = function(data, session, returndata) {
    // get this thread, its posts, and all forums (to build crumbs)

    // first, get the post counts
    // if response has no rows, exit early- the thread does not exist for all intents
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + '/_view/post-count?key="' + data.thread + '"',
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(countdata =>{
        if (countdata.rows.length == 0) {
            returndata({error: "Could not find specified thread"});
            return;
            
        } 

        // increment the thread views
        // maybe put something here to restrict spamming calls
        // like check the last time this thread was viewed this session
        utils.incrementThreadViews(data.thread);

        let maxposts = countdata.rows[0].value;
        let pge = 1;
        if (data.page) pge = data.page;
        if (pge == "last")
        {
            // calculate the last page

            pge = Math.floor(maxposts / 40) + 1;
        }
        let skipnum = 40 * (pge - 1);
        if (skipnum < 0) skipnum = 0;
        Promise.all([
            request({
                method: "GET",
                uri: utils.urlstart + utils.designdoc + '/_view/doc-by-id?key="' + data.thread + '"',
                headers: { Authorization: utils.totalAuthString },
                json: true
            }),
            request({
                method: "GET",
                uri: utils.urlstart + utils.designdoc + '/_view/posts-by-thread-and-date?startkey=["' + data.thread + '", "0"]&endkey=["' + data.thread + '", "9999-99-99T99:99:99.999Z"]&limit=40&skip=' + skipnum,
                headers: { Authorization: utils.totalAuthString },
                json: true
            }),
            request({
                method: "GET",
                uri: utils.urlstart + utils.designdoc + "/_view/forums-by-parent",
                headers: { Authorization: utils.totalAuthString },
                json: true
            })
        ]).then(promisevalues => {
            let [threads, posts, forums] = promisevalues;
            let thread = threads.rows[0].value;
            let returnData = {
                id: data.thread,
                title: thread.title,
                isGame: thread.isGame,
                postNum: thread.posts,
                posts: [],
                crumbs: []
            }
            // build a list of users
            let userlist = [];
            let characterlist = [];
            for (let row of posts.rows) {
                if (!userlist.includes(row.value.header.name)) 
                    userlist.push(row.value.header.name);
                if (row.value.header.alias && !characterlist.includes(row.value.header.alias))
                    characterlist.push('["' + row.value.header.name + '","' + row.value.header.alias + '"]');
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
            let usrString = '["' + userlist.join('","') + '"]';
            let charString = '[' + characterlist.join(",") + ']';
            Promise.all([
                request({
                    method: "GET",
                    uri: utils.urlstart + utils.designdoc + '/_view/user-by-name?keys=' + usrString,
                    headers: { Authorization: utils.totalAuthString },
                    json: true
                }),
                request({
                    method: "GET",
                    uri: utils.urlstart + utils.designdoc + '/_view/character-by-user-and-id?keys=' + charString,
                    headers: { Authorization: utils.totalAuthString },
                    json: true
                })
            ]).then(userchars => {
                let [userset, charset] = userchars;
                // for now, just do the users
                for (let post of returnData.posts) {
                    if (post.header.alias) {
                        for (let row of charset.rows) {
                            if (row.value.id == post.header.alias) {
                                post.header.title = row.value.title;
                                post.header.icon = row.value.icon;
                                post.header.char = row.value.name;
                            }
                        }
                    } else {
                        for (let row of userset.rows) {
                            if (row.value.name == post.header.name) {
                                post.header.title = row.value.title;
                                post.header.icon = row.value.icon;
                            }
                        }
                    }
                }
                
                returndata(returnData);
            }).catch(e => utils.quickErrorResponse(e, returndata));
            

        }).catch(e => utils.quickErrorResponse(e, returndata));
    }).catch (e => utils.quickErrorResponse(e, returndata));


    
}

exports.editPost = function (data, session, returndata) {
    if (!session.user) {
        returndata({error: "You are not logged in!"});
        return;
    }
    // check the new post stats
    if (!data.textBlock || !data.textBlock.text || typeof data.textBlock.text != "string") {
        returndata({error: "missing text attribute in request body"});
        return;
    }

    if (data.alias && typeof data.alias != "string") {
        returndata({error: "misformatted alias attribute"});
        return;
    }

    if (data.textBlock.text.length > 10000) {
        returndata({ error: "Too many characters in post"});
        return;
    }

    // we've been given a post number, but we could also possibly carry the database's internal id for every post
    let posti = data.post - 1;
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + '/_view/posts-by-thread-and-date?startkey=["' + data.thread + '", "0"]&endkey=["' + data.thread + '", "9999-99-99T99:99:99.999Z"]&limit=1&skip=' + posti,
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(postbody => {
        if (postbody.rows.length < 1) {
            returndata({error: "Post could not be found"});
            return;
        }
        let editedpost = postbody.rows[0].value;
        // TODO: Check user permissions
        if (editedpost.header.name != session.user.name) {
            returndata({error: "You lack permissions to edit this post"});
            return;
        }
        if (!editedpost.edit) {
            editedpost.edit = {
                original: editedpost.textBlock
            }
        }
        editedpost.edit.date = new Date().toISOString();
        editedpost.textBlock = data.textBlock;
        if (data.alias != undefined) {

            editedpost.header.alias = data.alias; // maybe verify this? since this is an edit we might have time
        }

        let editid = editedpost._id;
        delete editedpost._id;

        request({
            method: "PUT",
            uri: utils.urlstart + "/" + editid,
            headers: { Authorization: utils.totalAuthString },
            body: JSON.stringify(editedpost),
            resolveWithFullResponse: true
        }).then(response => {
            if (response.statusCode >= 400) {
                console.log(response);
                returndata({error: "An error occured between the server and the database"});
            } else {
                returndata({status: "Edit success!"});
            }
        }).catch(e => utils.quickErrorResponse(e, returndata));

    }).catch(e => utils.quickErrorResponse(e, returndata));
}