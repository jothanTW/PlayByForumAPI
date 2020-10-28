let configs = require("../../config/config.js");
let request = require("request-promise-native");
let crypto = require("crypto");
let fs = require("fs");
let filetype = require("file-type");
let imageDims = require("image-size");

let utils = require("./controllerUtils.js");

let userchecks = require("../../config/userInfoChecks");
const Character = require("../../models/character.js");

const minSalt = 64;

let sqlcon = utils.connection;

exports.doSignUp = function(data, session, returndata) {
    // get the auth string, decode it, make sure everything matches up
    let badReq = false;
    if (!data || !data.uauth || !data.id || !data.email) {
        returndata({ error: "Bad Request" });
        console.log(Object.keys(data));
        return;
    }
    let astr = data.uauth;
    let authparams = Buffer.from(astr, 'base64').toString().split(':');
    if (authparams.length != 2 || authparams[0] != data.id) {
        returndata({ error: "Bad Request" });
        return;
    }

    let checkstr =  userchecks.checkUserName(authparams[0]);
    if (checkstr.length > 0) {
        returndata({ error: checkstr });
        return;
    }
    checkstr =  userchecks.checkPassword(authparams[1]);
    if (checkstr.length > 0) {
        returndata({ error: checkstr });
        return;
    }
    checkstr =  userchecks.checkEmail(data.email);
    if (checkstr.length > 0) {
        returndata({ error: checkstr });
        return;
    }
    sqlcon.query("select count(*) as unum from users where userid = ?", [authparams[0]], (e, r, f) => {
        if (e) {
            console.log(e);
            returndata({ error: 'Account creation could not be completed at this time'});
            return;
        } else {
            if (r[0].unum == 0) {
                let len = utils.minSalt;
                let salt = crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len);
                let chash = crypto.createHmac('sha512', salt);
                chash.update(authparams[1]);
                let hash = chash.digest('hex');
                let userParams = [authparams[0], hash, salt, data.email, new Date().toISOString().split("T")[0]];
                sqlcon.query("insert into users (userid, pass_hash, pass_salt, email, registered_date) values (?, ?, ?, ?, ?)", userParams, (e1, r1, f1) => {
                    if (e1) {
                        console.log(e1);
                        returndata({ error: 'Account creation could not be completed at this time'});
                        return;
                    } else {
                        session.user = {
                            name: authparams[0],
                            roles: [],
                            dbid: r1.insertId
                        }
                        returndata({ status: "Account created!" });
                    }
                });
            } else {
                returndata({ error: "User already exists"});
            }
        }
    });

    
}

exports.doLogin2 = function(req, res) {
    // get the user, generate the hash from the salt, compare
    let astr = req.body.uauth;
    let authparams = Buffer.from(astr, 'base64').toString().split(':');
    if (authparams.length != 2 || authparams[0] != req.body.id) {
        res.status(400).send({ error: "Bad Request" });
        return;
    }

    sqlcon.query("select users.pkey pk, av icon, userid, pass_hash hash, pass_salt salt, forum, role " +
                    "from users left join user_roles on user_roles.user = users.pkey where userid = ?", [authparams[0]], (e, r, f) => {
        if (e) {
            console.log(e);
            res.status(500).send({ error: 'Login could not be completed at this time'});
        } else if (r.length == 0) {
            res.status(400).send({ error: "Invalid username or password"});
        } else {
            let userdata = r[0];
            let chash = crypto.createHmac('sha512', userdata.salt);
            chash.update(authparams[1]);
            let hash = chash.digest('hex');
            if (hash == userdata.hash) {
                let uroles = [];
                for (let i = 0; i < r.length; i++) {
                    if (r[i].role) {
                        uroles.push({forum: r[i].forum, role: r[i].role});
                    }
                }
                // good! save the user's session
                req.session.user = {
                    name: userdata.name,
                    roles: uroles,
                    dbid: userdata.pk
                }
                if (userdata.icon)
                    req.session.user.icon = userdata.icon;
                res.send({ status: "GOOD", user: session.user});
            } else {
                res.status(400).send({ error: "Invalid username or password"});
            }
        }
    });
}

exports.doLogin = function(data, session, returndata) {
    // get the user, generate the hash from the salt, compare
    let astr = data.uauth;
    let authparams = Buffer.from(astr, 'base64').toString().split(':');
    if (authparams.length != 2 || authparams[0] != data.id) {
        returndata({ error: "Bad Request" });
        return;
    }

    sqlcon.query("select users.pkey pk, av icon, userid, pass_hash hash, pass_salt salt, forum, role " +
                    "from users left join user_roles on user_roles.user = users.pkey where userid = ?", [authparams[0]], (e, r, f) => {
        if (e) {
            console.log(e);
            returndata({ error: 'Login could not be completed at this time'});
        } else if (r.length == 0) {
            returndata({ error: "Invalid username or password"});
        } else {
            let userdata = r[0];
            let chash = crypto.createHmac('sha512', userdata.salt);
            chash.update(authparams[1]);
            let hash = chash.digest('hex');
            if (hash == userdata.hash) {
                let uroles = [];
                for (let i = 0; i < r.length; i++) {
                    if (r[i].role) {
                        uroles.push({forum: r[i].forum, role: r[i].role});
                    }
                }
                // good! save the user's session
                session.user = {
                    name: userdata.userid,
                    roles: uroles,
                    dbid: userdata.pk
                }
                if (userdata.icon)
                    session.user.icon = userdata.icon;
                returndata({ status: "GOOD", user: session.user});
            } else {
                returndata({ error: "Invalid username or password"});
            }
        }
    });
}

exports.doLogout = function(data, session, returndata) {
    session.destroy(e => {
        if(e) utils.quickErrorResponse(e, returndata);
        else {
            returndata({ status: "You have been logged out"}, 'pbforum_sid');
        }
    });
}

exports.checkSession = function(data, session, returndata) {
    if (session.user) {
        returndata(session.user);
    } else {
        returndata({ error: 'Not logged in'}, 'pbforum_sid');
    }
}

exports.getIconData = function(req, res) {
    // nothing fancy, just provide the specified file
    fs.readFile("./icons/" + req.params.file, (err, data) => {
        if (err) {
            res.send();
            return;
        }
        let fileformat = filetype(data);
        res.set('Content-type', fileformat.mime);
        res.send(data);
    });
}

exports.getUserProfile = function(data, session, returndata) {
    /*  {
            username
            usertitle
            usericon
            characters
            posts
            threads -- in the future, when I'm storing thread creator info
        }*/  
    sqlcon.query("select users.userid, users.title, ifnull(users.av, '') av, (select count(*) from posts where posts.user = users.pkey) postnum, " +
                "characters.id cid, characters.name cname, characters.title ctitle, characters.av cicon " +
                "from users " +
                "left join characters on users.pkey = characters.user " +
                "where users.userid = ?", [data.user], (e, r, s) => {
        if (e) {
            console.log(e);
            returndata({error: "There was a server error getting the user"});
            return;
        }
        if (r.length == 0) {
            returndata({error: "No user with that id found"});
            return;
        }
        let userpdata = {
            name: r[0].userid,
            icon: r[0].av,
            title: r[0].title,
            postNum: r[0].postnum,
            characters: [],
            threads: []
        }
        if (r[0].cid) {
            for (let i = 0; i < r.length; i++) {
                let newCharacter = new Character(-1, r[i].cid, r[i].cname, r[i].userid, r[i].ctitle, r[i].cicon);
                userpdata.characters.push(newCharacter);
            }
        }
        // TODO: fetch threads
        returndata(userpdata);
    });
    /*
    Promise.all([
        request({
            method: "GET",
            uri: utils.urlstart + utils.designdoc + "/_view/user-by-name?key=\"" + data.user + "\"",
            headers: { Authorization: utils.totalAuthString },
            json: true
        }),
        request({
            method: "GET",
            uri: utils.urlstart + utils.designdoc + "/_view/user-post-count?key=\"" + data.user + "\"",
            headers: { Authorization: utils.totalAuthString },
            json: true
        }),
        request({
            method: "GET",
            uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + data.user + "\"",
            headers: { Authorization: utils.totalAuthString },
            json: true
        })
    ]).then(results => {
        let [udat, pcount, cdat] = results;
        let pcountactual = 0;
        if (pcount.rows.length)
            pcountactual = pcount.rows[0].value;
        if (udat.rows.length) {
            let userpdata = {
                name: udat.rows[0].value.name,
                icon: udat.rows[0].value.icon,
                title: udat.rows[0].value.title,
                postNum: pcountactual,
                characters: []
            }
            for (let crow of cdat.rows) {
                let character = Object.assign({}, crow.value);
                delete character._id;
                delete character._rev;
                userpdata.characters.push(character);
            }

            returndata({status: 'Character Found', data: userpdata});
        } else {
            returndata({error: "Could not find user"});
        }
    }).catch(e => utils.quickErrorResponse(e, returndata));*/
}

function updateCharacterIcon(charid, iconname, chardata) {
    // update the character's icon, retry db conflicts
    if (chardata) {
        // we've been given the most recent ish character data already
        let char = Object.assign({}, chardata);
        delete char._id;
        char.icon = iconname;
        request({
            method: "PUT",
            uri: utils.urlstart + "/" + charid,
            headers: { Authorization: utils.totalAuthString },
            body: JSON.stringify(char),
            resolveWithFullResponse: true
        }).catch(e => {
            if (e.statusCode == 409)
                updateCharacterIcon(charid, iconname);
            else
                console.log("Error in Character Icon update for " + charid + ": " + e.message);
        });
    } else {
        request({
            method: "GET",
            uri: utils.urlstart + utils.designdoc + '/_view/doc-by-id?key="' + charid + '"',
            headers: { Authorization: utils.totalAuthString },
            json: true
        }).then(doc =>{
            for (let row of doc.rows) {
                let char = Object.assign({}, row.value);
                delete char._id;
                char.icon = iconname;
                request({
                    method: "PUT",
                    uri: utils.urlstart + "/" + charid,
                    headers: { Authorization: utils.totalAuthString },
                    body: JSON.stringify(char),
                    resolveWithFullResponse: true
                }).catch(e => {
                    if (e.statusCode == 409)
                        updateCharacterIcon(charid, iconname);
                    else
                        console.log("Error in Character Icon update for " + charid + ": " + e.message);
                });
            }
        }).catch(e => console.log(e.message));
    }
}

function updateUserIcon(username, iconname) {
    // update the user's icon, retry db conflicts
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + '/_view/user-by-name?key="' + username + '"',
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(doc =>{
        for (let row of doc.rows) {
            let user = Object.assign({}, row.value);
            let userdbid = user._id;
            delete user._id;
            user.icon = iconname;
            request({
                method: "PUT",
                uri: utils.urlstart + "/" + userdbid,
                headers: { Authorization: utils.totalAuthString },
                body: JSON.stringify(user),
                resolveWithFullResponse: true
            }).catch(e => {
                if (e.statusCode == 409)
                    updateUserIcon(username, iconname);
                else
                    console.log("Error in User Icon update for " + username + ": " + e.message);
            });
        }
    }).catch(e => console.log(e.message));
}

exports.putIcon = function(data, session, returndata) {
    // upload a new icon
    // check with filetype, reject if not an image

    // if character exists, make sure it exists in db and the character belongs to the user

    // only the user should be able to do this to their own files!
    if (!data || !data.data || typeof data.data != "string" || data.data.length == 0) {
        returndata({error: "Missing image data"});
        return;
    }

    let imageBuffer = Buffer.from(data.data, 'base64');
    let fileformat = filetype(imageBuffer);
    if (!fileformat.mime.startsWith("image/")) {
        returndata({ error: "Expected image/ type, got " + fileformat.mime});
        return;
    }

    // check the size
    // as on client-side, we're expecting 1.2MB max
    if (imageBuffer.length > 1.2 * 1024 * 1024) {
        returndata({ error: "File too large! Expected 1.2MB max"});
        return;
    }

    // check the dimensions
    // as on client side, we're expecting 150x150px
    let imDims = imageDims(imageBuffer);
    if (imDims.width > 150 || imDims.height > 150) {
        returndata({ error: "Image too big! Expected 150 by 150 px"});
        return;
    }

    if (session.user) {
        if (data.character) {
            // update one of the user's characters
            // get the character id from the db
            request({
                method: "GET",
                uri: utils.urlstart + utils.designdoc + '/_view/character-by-user-and-id?key=["' + session.user.name + '", "' + data.character + '"]',
                headers: { Authorization: utils.totalAuthString },
                json: true
            }).then(doc =>{
                if (doc.rows.length == 0) {
                    returndata({error: "Could not find character!"});
                    return;
                }
                let filename = doc.rows[0].value._id + "." + fileformat.ext;
                fs.writeFile("icons/" + filename, imageBuffer, (err) => {
                    if (err) {
                        console.log(err);
                        returndata({error: "Image upload failed on server-side"});
                    } else {
                        // Update the character info
                        if (doc.rows[0].value.icon != filename) {
                            updateCharacterIcon(doc.rows[0].value._id, filename, doc.rows[0].value);
                        }

                        returndata({status: "Upload successful!", image: filename});
                    }
                })
            }).catch(e => console.log(e.message));

        } else {
            // update the user's own image
            // first, save the file
            // consider saving the file to a buffer file and copying over to the actual location
            let filename = session.user.dbid + "." + fileformat.ext;
            fs.writeFile("icons/" + filename, imageBuffer, (err) => {
                if (err) {
                    console.log(err);
                    returndata({error: "Image upload failed on server-side"});
                } else {
                    // Update the user's info

                    if (session.user.icon != filename) {
                        session.user.icon = filename;
                        updateUserIcon(session.user.name, filename);
                    }



                    returndata({status: "Upload successful!", image: filename});
                }
            })
        }
    } else {
        returndata({error: "You are not logged in!"});
    }
}

exports.editUser = function(data, session, returndata) {
    // assume only the user can edit their info
    // maybe later let admins do it too
    if (!session.user || session.user.name != data.user) {
        returndata({eror: "You do not have the permissions to edit this user"});
        return;
    }

    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + '/_view/user-by-name?key="' + session.user.name + '"',
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(doc =>{
        for (let row of doc.rows) {
            let user = Object.assign({}, row.value);
            let userdbid = user._id;
            delete user._id;
            
            // editable fields: 
            //  title
            //  uuuuuhhhh
            //
            //  never do name, do password ELSEWHERE, same w/ email

            let doEdit = false;

            if (data.title) {
                if (typeof data.title == 'string') {
                    user.title = data.title;
                    doEdit = true;
                } else {
                    returndata({error: "Title must be a string object"});
                    return;
                }
            }
            // do any other changes here

            if (!doEdit) {
                returndata({error: "No edit fields provided"});
                return;
            }
            request({
                method: "PUT",
                uri: utils.urlstart + "/" + userdbid,
                headers: { Authorization: utils.totalAuthString },
                body: JSON.stringify(user),
                resolveWithFullResponse: true
            }).then(response => {
                returndata({status: "Edit successful"})
            }).catch(e => utils.quickErrorResponse(e, returndata));
        }
    }).catch(e => console.log(e.message));
}