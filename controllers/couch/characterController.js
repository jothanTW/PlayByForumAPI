let configs = require("../../config/config.js");
let request = require("request-promise-native");

let utils = require("./controllerUtils");

// CHARACTER IDS ARE STORED AS KEBABS

exports.getCharacter = function(req, res) {
    // assume each character has a unique name under each player
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/characters-by-username?key=\"" + req.params.username + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(cdat => {
        for (let row of cdat.rows) {
            if (row.value.id == req.params.charactername) {
                let character = Object.assign({}, row.value);
                delete character._rev;
                delete character._id;
                res.send({status: "Character retrieved", character: character});
            }
        }

        // if we got here, we couldn't find the character
    }).catch(e => utils.quickErrorReturn(e, res));
}

exports.getAllCharacters = function(req, res) {
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/characters-by-username?key=\"" + req.params.username + "\"",
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
        res.send({ error: "Character statblock must exist!"})
    }
    if (!req.body.characterName || typeof req.body.charactername != "string" || req.body.characterName.length == 0) {
        res.send({error: "Character must have a name!"});
    }

    let charid = utils.makeKebab(req.body.characterName);
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/characters-by-username?key=\"" + req.params.username + "\"",
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
            user: req.params.user
        }
        if (req.body.title && typeof req.body.title == "string") characterData.title = req.body.title;
        if (req.body.icon && typeof req.body.icon == "string") characterData.icon = req.body.icon;
        if (req.body.smallicon && typeof req.body.smallicon == "string") characterData.smallicon = req.body.smallicon;

        request({
            method: "POST",
            uri: utils.urlstart,
            headers: { Authorization: utils.totalAuthString },
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
    
}