let configs = require("../../config/config.js");
let request = require("request-promise-native");
let crypto = require("crypto");

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
                        roles: newuser.roles
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
                    roles: userdata.roles
                }
                res.send({ status: "GOOD"});
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