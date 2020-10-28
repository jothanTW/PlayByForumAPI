let utils = require("./controllerUtils");
let request = require("request-promise-native");

let Thread = require("../../models/thread");
let User = require("../../models/user");
let ExpandedPost = require("../../models/expanded-post");
let Character = require("../../models/character");
const { query } = require("express");

let msqlcon = utils.connection;

exports.makePost = function(data, session, returndata) {
    if (session.user) {
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

            let threadid = data.thread;
            if (threadid.indexOf("~") == -1) {
                threadid = threadid + "~1";
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

            // get the thread data
            // make sure the thread exists, and if we are attaching game data, make sure it's a game thread and the character is valid
            // since we're also getting the last post number, also make this a transaction
            msqlcon.getConnection((conerr, connection) => {
                if (conerr) throw conerr;
                connection.beginTransaction(bterr => {
                    if (bterr) throw bterr;

                    connection.query("select threads.pkey, threads.id, threads.name, threads.is_game_thread, (select max(num) from posts where posts.parent = threads.pkey) maxPostNum, " +
                                        "characters.pkey ckey, characters.id cid, characters.name cname, " +
                                        "users.pkey ukey, users.userid " +
                                    "from threads " +
                                    "left join thread_characters on thread_characters.thread = threads.pkey " +
                                    "left join characters on thread_characters.character = characters.pkey " +
                                    "left join users on characters.user = users.pkey " +
                                    "where threads.id = ?;", [threadid], (selerr, selret, f) => {
                        if (selerr) throw selerr;
                        if (selret.length == 0) {
                            returndata({error: "Specified thread does not exist"});
                            return;
                        }
                        // if you want to enforce character posting only in game threads, check it here
                        //if (selret[0].is_game_thread) {
                        //    
                        //} else {
                        //    
                        //}
                        console.log(selret);
                        let charfound = -1;
                        if (data.alias) {
                            for (let i = 0; i < selret.length; i++) {
                                if (selret[i].userid == session.user.name && selret[i].cid == data.alias) {
                                    charfound = selret[i].ckey;
                                    break;
                                }
                            }
                            if (charfound == -1) {
                                returndata({error: "Specified character " + data.alias + " is not part of this thread"});
                                return;
                            }
                        }
                        let postarray = [selret[0].pkey, selret[0].maxPostNum + 1, session.user.dbid, data.text];
                        if (data.alias) {
                            postarray.push(charfound);
                        } else {
                            postarray.push(null);
                        }
                        if (data.ooc) {
                            postarray.push(data.ooc);
                        } else {
                            postarray.push(null);
                        }
                        connection.query("insert into posts (parent, num, user, content, posts.character, ooc) values (?, ?, ?, ?, ?, ?)", postarray, (inserr, insret, f) => {
                            if (inserr) {
                                connection.rollback(err => {
                                    if (err) throw err;
                                    throw inserr;
                                });
                                return;
                            }
                            connection.commit(cerr => {
                                if (cerr) {
                                    connection.rollback(err => {
                                        if (err) throw err;
                                        throw cerr;
                                    });
                                    return;
                                }
                                returndata({status: "GOOD"});
                            })
                        });
                    });
                });
            });
        } else {
            returndata({error: "Attached text must be a string object"});
        }
    } else {
        returndata({ error: "You are not logged in!"})
    }
}

exports.makePost2 = function(data, session, returndata) {
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
    // get this thread, its posts, all forums (to build crumbs), and all associated maps

    // assume all thread ids have a tilde; if not, append ~1
    let threadid = data.thread;
    if (threadid.indexOf("~") == -1) {
        threadid = threadid + "~1";
    }
    msqlcon.query("select threads.pkey, threads.id, threads.name, threads.parent, threads.is_game_thread, " +
                    "owners.pkey ownerkey, owners.userid ownerid, " +
                    "posts.num, posts.content, ifnull(posts.ooc, '') ooc, posts.post_date, posts.last_edit, " +
                    "users.pkey userkey, users.userid, users.title, users.email, users.av, users.registered_date, " +
                    "characters.pkey ckey, characters.id charid, characters.name charname, characters.av charav, characters.title chartitle, " +
                    "forums.id forumid " +
                "from threads " +
                "join posts on posts.parent = threads.pkey and posts.rev_stack = 0 " +
                "join users on posts.user = users.pkey " +
                "join users owners on owners.pkey = threads.owner " +
                "left join characters on posts.character = characters.pkey " + 
                "join forums on threads.parent = forums.pkey " +
                "where threads.id = ?;", [threadid], (e, r, f) => {
        if (e) {
            console.log(e);
            returndata({error: "There was a server error fetching the thread"});
            return;
        }
        if (r.length == 0) {
            returndata({error: "The specified thread could not be found"});
            return;
        }

        // increment the thread views
        // maybe put something here to restrict spamming calls
        // like check the last time this thread was viewed this session
        utils.incrementThreadViews(data.thread);
        
        utils.getForumHierarchy(groups => {

            let pforum = getForumFromHierarchy(groups, r[0].forumid);
            let returnData = {
                id: threadid,
                title: r[0].name,
                isGame: r[0].is_game_thread,
                postNum: r.length,
                owner: r[0].ownerid,
                posts: [],
                characters: [],
                crumbs: pforum.crumbs,
                maps: []
            }
            // TODO: get only a range of posts
            for (let i = 0; i < r.length; i++) {
                let newUser = new User(r[i].userkey, r[i].userid, r[i].title, r[i].email);
                let userChar = null;
                if (r[i].ckey)
                    userChar = new Character(r[i].ckey, r[i].charid, r[i].charname, r[i].userid, r[i].chartitle, r[i].charav);
                let newPost = new ExpandedPost(r[i].pkey, r[i].num, newUser, r[i].content, r[i].post_date, userChar);
                newPost.textBlock.ooc = r[i].ooc;
                newPost.edit.date = r[i].last_edit;
                returnData.posts.push(newPost);
            }

            //TODO: get maps

            //TODO: get characters
            msqlcon.query("select characters.pkey, characters.id, characters.name, users.userid, characters.title, characters.av " +
                            "from characters join users on characters.user = users.pkey " +
                            "join thread_characters on thread_characters.character = characters.pkey " +
                            "join threads on threads.pkey = thread_characters.thread " +
                            "where threads.id = ?", [threadid], (ce, cr, f) => {
                if (ce) {
                    console.log(ce);
                    returndata({error: "There was a server error fetching the thread"});
                    return;
                }
                for (let i = 0; i < cr.length; i++) {
                    let newCharacter = new Character(cr[i].pkey, cr[i].id, cr[i].name, cr[i].userid, cr[i].title, cr[i].av);
                    returnData.characters.push(newCharacter);
                }
                returndata(returnData);
            })

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
                f.crumbs.push({id: forum.subforums[i].id, title: forum.subforums[i].name});
                return f;
            }
        }
    }
    return null;
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

exports.addMap = function(data, session, returndata) {
    // can we verify an image link from here?
    // frontend will only draw it to canvas, anyway

    // make sure the user is logged in, get the thread data, make sure the user is a thread owner
    if (!session.user) {
        returndata({error: "You are not logged in!"});
        return;
    }
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + '/_view/doc-by-id?key="' + data.thread + '"',
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(rdata => {
        let threadfound = false;
        for (let row of rdata.rows) {
            if (row.value.type == 'thread') {
                threadfound = true;
                let tdata = row.value;
                if (!tdata.isGame) {
                    returndata({error: "This thread does not support maps"});
                    return;
                }
                if (session.user.name != tdata.user) {
                    returndata({error: "You do not have permissions to do that"});
                    return;
                }
                if (!data.mapname || typeof data.mapname != "string" || data.mapname.length == 0) {
                    returndata({error: 'Missing map name'});
                    return;
                }
                if (!data.mapsource || typeof data.mapsource != "string" || data.mapsource.length == 0) {
                    returndata({error: 'Missing map source'});
                    return;
                }
                if (!data.gridsize) {
                    returndata({error: 'Missing map grid data'});
                    return;
                }
                let mapdata = {
                    title: data.mapname,
                    type: "map",
                    parent: data.thread,
                    source: data.mapsource,
                    grid: {
                        size: data.gridsize
                    },
                    icons: []
                }
                if (data.gridoffx) mapdata.grid.offx = data.gridoffx;
                if (data.gridoffy) mapdata.grid.offy = data.gridoffy;

                // post the new map
                request({
                    method: "POST",
                    uri: utils.urlstart,
                    headers: { Authorization: utils.totalAuthString, "Content-Type": "application/json" },
                    body: JSON.stringify(mapdata),
                    resolveWithFullResponse: true
                }).then(response => {
                    // if we get a bad status code, it chould be caught
                    returndata({status: "Map created!"});
                }).catch(e => utils.quickErrorResponse(e, returndata));
            }
        }
        if (!threadfound) {
            returndata({error: 'Sepcified thread could not be found'});
            return;
        }
    }).catch(e => utils.quickErrorResponse(e, returndata));
}

exports.addCharacterToThread = function(data, session, returndata) {
    // only the thread owner should do this?
    // only should happen in game threads?
    if (session.user) {
        // get the thread, user, and character; make sure the character isn't already in the list
        if (!data || !data.thread || data.thread.length == 0) {
            returndata({error: "thread must be defined!"});
            return;
        }
        if (!data.username || typeof data.username != "string" || data.username.length == 0) {
            returndata({error: "character's user must be defined!"});
            return;
        }
        if (!data.charactername || typeof data.charactername != "string" || data.charactername.length == 0) {
            returndata({error: "character must be defined!"});
            return;
        }

        let threadid = data.thread;
        if (threadid.indexOf("~") == -1)
            threadid = threadid + "~1";
        // should be a transaction to be safe. if people other than the thread owner can do this, it will NEED it
        msqlcon.getConnection((conerr, connection) => {
            if (conerr) {
                console.log(conerr);
                returndata({error: "There was a server error adding the character"});
                return;
            }
            connection.beginTransaction(terr => {
                if (terr) {
                    console.log(terr);
                    returndata({error: "There was a server error adding the character"});
                    return;
                }
                // get the thread info and the existing characters
                connection.query("select threads.pkey, threads.id, threads.name, threads.is_game_thread, " +
                                    "characters.pkey ckey, characters.id cid, characters.name cname, " +
                                    "users.pkey ukey, users.userid, owner.pkey ownerkey, owner.userid ownerid " +
                                "from threads " +
                                "left join thread_characters on thread_characters.thread = threads.pkey " +
                                "left join characters on thread_characters.character = characters.pkey " +
                                "left join users on characters.user = users.userid " +
                                "join users owner on owner.pkey = threads.owner " +
                                "where threads.id = ?", [threadid], (tcerr, tcret, f) => {
                    if (tcerr) {
                        console.log(tcerr);
                        returndata({error: "There was a server error adding the character"});
                        return;
                    }
                    if (tcret.length == 0) {
                        returndata({error: "Specified thread does not exist"});
                        return;
                    }
                    if (session.user.name != tcret[0].ownerid) {
                        returndata({error: "You are not the owner of this thread"});
                        return;
                    }
                    for (let i = 0; i < tcret.length; i++) {
                        if (tcret[i].userid == data.usermame && tcret[i].cid == data.charactername) {
                            returndata({error: "Specified character is already in the thread"});
                            return;
                        }
                    }

                    // make sure the character exists under the user
                    connection.query("select characters.pkey, characters.id, characters.name, " +
                                        "users.pkey ukey, users.userid " +
                                    "from characters join users on users.pkey = characters.user " +
                                    "where userid = ? and id = ?", [data.username, data.charactername], (ucerr, ucret, f) => {
                        if (ucerr) {
                            console.log(ucerr);
                            returndata({error: "There was a server error adding the character"});
                            return;
                        }
                        if (ucret.length == 0) {
                            returndata({error: "Specified character does not exist"});
                            return;
                        }

                        // we have everything. add it to the db.
                        let insargs = [tcret[0].pkey, ucret[0].pkey, "{}"];
                        connection.query("insert into thread_characters (thread, thread_characters.character, game_stats) values (?, ?, ?)", insargs, (inerr, inret, f) => {
                            if (inerr) {
                                connection.rollback(rollerr => {
                                    console.log(inerr);
                                    if (rollerr) console.log(rollerr);
                                    returndata({error: "There was a server error adding the character"});
                                    return;
                                });
                            }
                            connection.commit(comerr => {
                                if (comerr) {
                                    connection.rollback(rollerr => {
                                        console.log(comerr);
                                        if (rollerr) console.log(rollerr);
                                        returndata({error: "There was a server error adding the character"});
                                        return;
                                    });
                                }
                                returndata({status: "GOOD"});
                            });
                        })
                    });
                });
            });
        });
    } else {
        returndata({ error: "You are not logged in!"})
    }
}