let configs = require("../../config/config.js");
let request = require("request-promise-native");
let crypto = require("crypto");
let fs = require("fs");
let filetype = require("file-type");
let imageDims = require("image-size");

let utils = require("./controllerUtils.js");

let userchecks = require("../../config/userInfoChecks");

const minSalt = 64;

exports.doSignUp = function(req, res) {
    // get the auth string, decode it, make sure everything matches up
    let badReq = false;
    if (!req.body || !req.body.uauth || !req.body.id || !req.body.email) {
        res.send({ error: "Bad Request" });
        console.log(Object.keys(req));
        return;
    }
    let astr = req.body.uauth;
    let authparams = Buffer.from(astr, 'base64').toString().split(':');
    if (authparams.length != 2 || authparams[0] != req.body.id) {
        res.send({ error: "Bad Request" });
        return;
    }

    let checkstr =  userchecks.checkUserName(authparams[0]);
    if (checkstr.length > 0) {
        res.send({ error: checkstr });
    }
    checkstr =  userchecks.checkPassword(authparams[1]);
    if (checkstr.length > 0) {
        res.send({ error: checkstr });
    }
    checkstr =  userchecks.checkEmail(req.body.email);
    if (checkstr.length > 0) {
        res.send({ error: checkstr });
    }

    // see if the user exists
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/user-by-name?key=\"" + authparams[0] + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(udat => {
        if (udat.rows.length > 0) {
            res.send({ error: "User already exists"});
        } else {
            // should have everything. put a new doc in the database
            let len = utils.minSalt;
            let salt = crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len);
            let chash = crypto.createHmac('sha512', salt);
            chash.update(authparams[1]);
            let hash = chash.digest('hex');
            let newuser = {
                name: authparams[0],
                hash: hash,
                salt: salt,
                email: req.body.email,
                type: "user",
                roles: []
            };
            request({
                method: "POST",
                uri: utils.urlstart,
                headers: { Authorization: utils.totalAuthString, "Content-Type": "application/json" },
                body: JSON.stringify(newuser),
                resolveWithFullResponse: true
            }).then(response => {
                if (response.statusCode > 300) {
                    res.send({ error: 'Account creation could not be completed at this time'});
                } else {
                    req.session.user = {
                        name: newuser.name,
                        roles: newuser.roles,
                        dbid: newuser._id
                    }
                    res.send({ status: "Account created!" });
                }
            }).catch(e => utils.quickErrorReturn(e, res));
        }
    }).catch(e => utils.quickErrorReturn(e, res));
    
}

exports.doLogin = function(req, res) {
    // get the user, generate the hash from the salt, compare
    let astr = req.body.uauth;
    let authparams = Buffer.from(astr, 'base64').toString().split(':');
    if (authparams.length != 2 || authparams[0] != req.body.id) {
        res.send({ error: "Bad Request" });
        return;
    }

    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/user-by-name?key=\"" + authparams[0] + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(udat => {
        if (udat.rows.length == 0) {
            res.send({ error: "Invalid username or password"});
        } else {
            let userdata = udat.rows[0].value;
            let chash = crypto.createHmac('sha512', userdata.salt);
            chash.update(authparams[1]);
            let hash = chash.digest('hex');
            if (hash == userdata.hash) {
                // good! save the user's session
                req.session.user = {
                    name: userdata.name,
                    roles: userdata.roles,
                    dbid: userdata._id
                }
                if (userdata.icon)
                    req.session.user.icon = userdata.icon;
                res.send({ status: "GOOD", user: req.session.user});
            } else {
                res.send({ error: "Invalid username or password"});
            }
        }
    }).catch(e => utils.quickErrorReturn(e, res));
}

exports.doLogout = function(req, res) {
    req.session.destroy(e => {
        if(e) utils.quickErrorReturn(e, res);
        else {
            res.clearCookie('pbforum_sid');
            res.send({ status: "You have been logged out"});
        }
    });
}

exports.checkSession = function(req, res) {
    if (req.session.user) {
        res.send(req.session.user);
    } else {
        res.clearCookie('pbforum_sid');
        res.send({ error: 'Not logged in'});
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

exports.getUserProfile = function(req, res) {
    /*  {
            username
            usertitle
            usericon
            characters
            posts
            threads -- in the future, when I'm storing thread creator info
        }*/  
    Promise.all([
        request({
            method: "GET",
            uri: utils.urlstart + utils.designdoc + "/_view/user-by-name?key=\"" + req.params.user + "\"",
            headers: { Authorization: utils.totalAuthString },
            json: true
        }),
        request({
            method: "GET",
            uri: utils.urlstart + utils.designdoc + "/_view/user-post-count?key=\"" + req.params.user + "\"",
            headers: { Authorization: utils.totalAuthString },
            json: true
        }),
        request({
            method: "GET",
            uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + req.params.user + "\"",
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

            res.send({status: 'Character Found', data: userpdata});
        } else {
            res.send({error: "Could not find user"});
        }
    }).catch(e => utils.quickErrorReturn(e, res));
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

exports.putIcon = function(req, res) {
    // upload a new icon
    // check with filetype, reject if not an image

    // if character exists, make sure it exists in db and the character belongs to the user

    // only the user should be able to do this to their own files!
    if (!req.body || !req.body.data || typeof req.body.data != "string" || req.body.data.length == 0) {
        res.send({error: "Missing image data"});
        return;
    }

    let imageBuffer = Buffer.from(req.body.data, 'base64');
    let fileformat = filetype(imageBuffer);
    if (!fileformat.mime.startsWith("image/")) {
        res.send({ error: "Expected image/ type, got " + fileformat.mime});
        return;
    }

    // check the size
    // as on client-side, we're expecting 1.2MB max
    if (imageBuffer.length > 1.2 * 1024 * 1024) {
        res.send({ error: "File too large! Expected 1.2MB max"});
        return;
    }

    // check the dimensions
    // as on client side, we're expecting 150x150px
    let imDims = imageDims(imageBuffer);
    if (imDims.width > 150 || imDims.height > 150) {
        res.send({ error: "Image too big! Expected 150 by 150 px"});
        return;
    }

    if (req.session.user) {
        if (req.params.character) {
            // update one of the user's characters
            // get the character id from the db
            request({
                method: "GET",
                uri: utils.urlstart + utils.designdoc + '/_view/character-by-user-and-id?key=["' + req.session.user.name + '", "' + req.params.character + '"]',
                headers: { Authorization: utils.totalAuthString },
                json: true
            }).then(doc =>{
                if (doc.rows.length == 0) {
                    res.send({error: "Could not find character!"});
                    return;
                }
                let filename = doc.rows[0].value._id + "." + fileformat.ext;
                fs.writeFile("icons/" + filename, imageBuffer, (err) => {
                    if (err) {
                        console.log(err);
                        res.send({error: "Image upload failed on server-side"});
                    } else {
                        // Update the character info
                        if (doc.rows[0].value.icon != filename) {
                            updateCharacterIcon(doc.rows[0].value._id, filename, doc.rows[0].value);
                        }

                        res.send({status: "Upload successful!", image: filename});
                    }
                })
            }).catch(e => console.log(e.message));

        } else {
            // update the user's own image
            // first, save the file
            // consider saving the file to a buffer file and copying over to the actual location
            let filename = req.session.user.dbid + "." + fileformat.ext;
            fs.writeFile("icons/" + filename, imageBuffer, (err) => {
                if (err) {
                    console.log(err);
                    res.send({error: "Image upload failed on server-side"});
                } else {
                    // Update the user's info

                    if (req.session.user.icon != filename) {
                        req.session.user.icon = filename;
                        updateUserIcon(req.session.user.name, filename);
                    }



                    res.send({status: "Upload successful!", image: filename});
                }
            })
        }
    } else {
        res.send({error: "You are not logged in!"});
    }
}

exports.editUser = function(req, res) {
    // assume only the user can edit their info
    // maybe later let admins do it too
    if (!req.session.user || req.session.user.name != req.params.user) {
        res.send({eror: "You do not have the permissions to edit this user"});
        return;
    }

    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + '/_view/user-by-name?key="' + req.session.user.name + '"',
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

            if (req.body.title) {
                if (typeof req.body.title == 'string') {
                    user.title = req.body.title;
                    doEdit = true;
                } else {
                    res.send({error: "Title must be a string object"});
                    return;
                }
            }
            // do any other changes here

            if (!doEdit) {
                res.send({error: "No edit fields provided"});
                return;
            }
            request({
                method: "PUT",
                uri: utils.urlstart + "/" + userdbid,
                headers: { Authorization: utils.totalAuthString },
                body: JSON.stringify(user),
                resolveWithFullResponse: true
            }).then(response => {
                res.send({status: "Edit successful"})
            }).catch(e => utils.quickErrorReturn(e, res));
        }
    }).catch(e => console.log(e.message));
}