let configs = require("../../config/config.js");
let request = require("request-promise-native");

let utils = require("./controllerUtils");

// CHARACTER IDS ARE STORED AS KEBABS

exports.getCharacter = function(req, res) {
    // assume each character has a unique name under each player
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + req.params.username + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(cdat => {
        for (let row of cdat.rows) {
            if (row.value.id == req.params.charactername) {
                let character = Object.assign({}, row.value);
                delete character._rev;
                delete character._id;
                res.send({status: "Character retrieved", character: character});
                return;
            }
        }
        res.send({error: "Could not find character under that user/id"});
        // if we got here, we couldn't find the character
    }).catch(e => utils.quickErrorReturn(e, res));
}

exports.getAllCharacters = function(req, res) {
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + req.params.username + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(cdat => {
        let characters = [];
        for (let row of cdat.rows) {
            let character = Object.assign({}, row.value);
            delete character._rev;
            delete character._id;
            characters.push(character);
        }
        res.send({status: characters.length + " character" + (characters.length == 1 ? '' : 's') + " found", characters: characters});

    }).catch(e => utils.quickErrorReturn(e, res));
}

exports.addCharacter = function(req, res) {
    if (!req.session.user) {
        res.send({error: "You are not logged in!"});
        return;
    }
    // if we get here, we have the character name and user name
    // the only other thing we need is the statblock from the request body
    // optionally: get the title text, a large icon, and a small icon

    // first see if a character by that name exists, and if the max number of characters has been reached
    if (!req.body || !req.body.statBlock) {
        res.send({ error: "Character statblock must exist!"});
        return;
    }
    if (!req.body.characterName || typeof req.body.characterName != "string" || req.body.characterName.length == 0) {
        res.send({error: "Character must have a name!"});
        return;
    }

    let charid = utils.makeKebab(req.body.characterName);
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + req.params.username + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(cdat => {
        if (cdat.rows >= configs.configs.maxCharactersPerUser) {
            res.send({error : "Maximum character limit reached!"});
        }
        
        for (let row of cdat.rows) {
            if (row.value.id == charid) {
                res.send({error: "Character by that name already exists!"});
                return;
            }
        }

        let characterData = {
            name: req.body.characterName,
            id: charid,
            statBlock: req.body.statBlock,
            user: req.params.username,
            type: "character"
        }
        if (req.body.title && typeof req.body.title == "string") characterData.title = req.body.title;
        if (req.body.icon && typeof req.body.icon == "string") characterData.icon = req.body.icon;
        if (req.body.smallicon && typeof req.body.smallicon == "string") characterData.smallicon = req.body.smallicon;

        request({
            method: "POST",
            uri: utils.urlstart,
            headers: { Authorization: utils.totalAuthString, "Content-Type": "application/json" },
            body: JSON.stringify(characterData),
            resolveWithFullResponse: true
        }).then(response => {
            if (response.statusCode >= 400) {
                console.log(response);
                res.send({error: "An error occurred between the server and the database"});
            } else {
                res.send({status: "Character created!", charid: charid});
            }
        }).catch(e => utils.quickErrorReturn(e, res));

    }).catch(e => utils.quickErrorReturn(e, res));

}

exports.editCharacter = function(req, res) {
    // Edit a character statblock or title
    // images are edited elsewhere
    // if we get a database conflict, do not resend- give an error and let the user deal with it

    // only users should be able to do this! Maybe admins can do this for everyone?
    if (!req.session.user || req.session.user.name != req.params.username) {
        res.send({error: "You do not have permission to edit that character"});
        return;
    }

    if (!req.body || !req.body.statBlock) {
        // TODO : more statblock verification
        res.send({error: "Missing statBlock"});
        return;
    }

    if (req.body.title && typeof req.body.title != "string") {
        res.send({error: 'Title is not a string object!'});
        return;
    }

    // locate the character
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + req.session.user.name + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(cdat => {
        let charfound = false;
        for (let row of cdat.rows) {
            if (row.value.id == req.params.charactername) {
                charfound = true;
                let character = Object.assign({}, row.value);
                let chardbid = character._id;
                delete character._id;

                character.statBlock = req.body.statBlock;
                character.title = req.body.title;

                request({
                    method: "PUT",
                    uri: utils.urlstart + "/" + chardbid,
                    headers: { Authorization: utils.totalAuthString },
                    body: JSON.stringify(character),
                    resolveWithFullResponse: true
                }).then(response => {
                    if (response.statusCode == 409) {
                        // db conflict
                        res.send({error: "There was a database update conflict"});
                    } else if (response.statusCode >= 400) {
                        res.send({error: "There was an error between the server and the database"});
                        console.log(response);
                    } else {
                        res.send({status: "Character updated!"});
                    }
                }).catch(e => console.log(e.message));
            }
        }
        if (!charfound)
        res.send({error: "Could not find character under that user/id"});
    }).catch(e => utils.quickErrorReturn(e, res));
}