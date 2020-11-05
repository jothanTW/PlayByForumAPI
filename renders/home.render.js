let configs = require("../config/config.js");
let utils = require("../controllers/" + configs.dbDirectory + "/controllerUtils");
let forumController = require("../controllers/" + configs.dbDirectory + "/forumController");
let threadController = require("../controllers/" + configs.dbDirectory + "/threadController");
let userController = require("../controllers/" + configs.dbDirectory + "/userController");
let controller = require("../controllers/" + configs.dbDirectory + "/groupController");

exports.renderThreadPage = utils.createTrueResponseFunction((data, session, res) => {
    threadController.getThreadData(data, session, response => {
        if (response.error) {
            // navigate to an error page?
            res.redirect("/");
        } else
        res.render("thread-page.ejs", {threaddata: response}, (err, str) => {
            if (err) {
                console.log(err);
                res.status(500).send({error: "There was an error loading the file for this page"});
            } else {
                res.send(str);
            }
        });
    });
});

exports.renderForumPage = utils.createTrueResponseFunction((data, session, res) => {
    forumController.getForumData(data, session, (response) => {
        if (response.error) {
            // navigate to an error page?
            res.redirect("/");
        } else
        res.render("forum-page.ejs", {forumpage: response}, (err, str) => {
            if (err) {
                console.log(err);
                res.status(500).send({error: "There was an error loading the file for this page"});
            } else {
                res.send(str);
            }
        });
    });
});
exports.renderHomepage = function(req, res) {
    // get the groups data
    controller.getGroupsData({}, {}, data => {
        res.render("home.ejs", {data: data}, (err, str) => {
            if (err) {
                console.log(err);
                res.status(500).send("There was an error loading the file for this page");
            } else {
                res.send(str);
            }
        });
    });
}
exports.renderLoginPage = function(req, res) {
    if (req.session.user) {
        res.redirect("/");
        return;
    }
    res.render("login.ejs", { data: {}}, (err, str) => {
        if (err) {
            console.log(err);
            res.status(500).send("There was an error loading the file for this page");
        } else {
            res.send(str);
        }
    });
}
exports.dologin = function(req, res) {
    let data = Object.assign({}, req.body, req.params);
    data.uauth = Buffer.from(req.body.id + ":" + req.body.password).toString('base64');
    //console.log(authstring);
    userController.doLogin(data, req.session, retdata => {
        if (retdata.error) {
            res.render("login.ejs", { data: {error: retdata.error}}, (err, str) => {
                if (err) {
                    console.log(err);
                    res.status(500).send("There was an error loading the file for this page");
                } else {
                    res.send(str);
                }
            });
        } else {
            req.session.user = retdata.user;
            res.redirect("/");
        }
    });
}

exports.doRegister = function(req, res) {
    let data = Object.assign({}, req.body, req.params);
    data.uauth = Buffer.from(req.body.id + ":" + req.body.password).toString('base64');
    userController.doSignUp(data, req.session, retdata => {
        if (retdata.error) {
            res.render("login.ejs", { data: {error: retdata.error, isRegistering: true}}, (err, str) => {
                if (err) {
                    console.log(err);
                    res.status(500).send("There was an error loading the file for this page");
                } else {
                    res.send(str);
                }
            });
        } else {
            req.session.user = retdata.user;
            res.redirect("/user/" + retdata.user.name);
        }
    });
}

exports.doLogout = function(req, res) {
    req.session.destroy(e => {
        res.clearCookie(configs.cookiename);

        res.redirect("/");
    });
}

exports.renderProfile = utils.createTrueResponseFunction((data, session, res) => {
    if (!data.user) {
        if (session.user) {
            res.redirect("/user/" + session.user.name);
            return;
        } else {
            res.redirect("/");
            return;
        }
    }
    userController.getUserProfile(data, session, (response) => {
        if (response.error) {
            // navigate to an error page?
            res.redirect("/");
        } else
        res.render("profile.ejs", {user: response}, (err, str) => {
            if (err) {
                console.log(err);
                res.status(500).send({error: "There was an error loading the file for this page"});
            } else {
                res.send(str);
            }
        });
    });
});

exports.makePost = utils.createTrueResponseFunction((data, session, res) => {
    threadController.makePost(data, session, rdata => {
        if (rdata.error) {
            res.redirect('/');
            return;
        }
        res.redirect('/thread/' + data.thread);
        return;
    })
});

exports.getCreateThreadPage = function(req, res) {
    if (!req.session.user) {
        res.redirect('/');
        return;
    }
    utils.getForumHierarchy(groups => {
        let thisForumData = utils.getForumFromHierarchy(groups, req.params.forum);
        res.render("new-thread", {forumdata: thisForumData}, (err, str) => {
            if (err) {
                console.log(err);
                res.status(500).send({error: "There was an error loading the file for this page"});
            } else {
                res.send(str);
            }
        });
    });
}

exports.postThread = function(req, res) {
    let data = Object.assign({}, req.body, req.params);
    console.log(data);
    forumController.makeThread(data, req.session, status => {
        if (status.error) {
            // show error page?
            console.log(status.error);
            res.redirect('/forum/' + data.forum + "/new-thread");
            return;
        }
        res.redirect('/thread/' + status.threadid);
    })

}