let configs = require("../../config/config.js");
let request = require("request-promise-native");

let utils = require("./controllerUtils");

// CHARACTER IDS ARE STORED AS KEBABS

exports.getCharacter = function(data, session, returndata) {
    // assume each character has a unique name under each player
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + data.username + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(cdat => {
        for (let row of cdat.rows) {
            if (row.value.id == data.charactername) {
                let character = Object.assign({}, row.value);
                delete character._rev;
                delete character._id;
                returndata({status: "Character retrieved", character: character});
                return;
            }
        }
        returndata({error: "Could not find character under that user/id"});
        // if we got here, we couldn't find the character
    }).catch(e => utils.quickErrorResponse(e, returndata));
}

exports.getAllCharacters = function(data, session, returndata) {
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + data.username + "\"",
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
        returndata({status: characters.length + " character" + (characters.length == 1 ? '' : 's') + " found", characters: characters});

    }).catch(e => utils.quickErrorResponse(e, returndata));
}

exports.addCharacter = function(data, session, returndata) {
    if (!session.user) {
        returndata({error: "You are not logged in!"});
        return;
    }
    // if we get here, we have the character name and user name
    // the only other thing we need is the statblock from the request body
    // optionally: get the title text, a large icon, and a small icon

    // first see if a character by that name exists, and if the max number of characters has been reached
    if (!data || !data.statBlock) {
        returndata({ error: "Character statblock must exist!"});
        return;
    }
    if (!data.characterName || typeof data.characterName != "string" || data.characterName.length == 0) {
        returndata({error: "Character must have a name!"});
        return;
    }

    let charid = utils.makeKebab(data.characterName);
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + data.username + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(cdat => {
        if (cdat.rows >= configs.maxCharactersPerUser) {
            returndata({error : "Maximum character limit reached!"});
        }
        
        for (let row of cdat.rows) {
            if (row.value.id == charid) {
                returndata({error: "Character by that name already exists!"});
                return;
            }
        }

        let characterData = {
            name: data.characterName,
            id: charid,
            statBlock: data.statBlock,
            user: data.username,
            type: "character"
        }
        if (data.title && typeof data.title == "string") characterData.title = data.title;
        if (data.icon && typeof data.icon == "string") characterData.icon = data.icon;
        if (data.smallicon && typeof data.smallicon == "string") characterData.smallicon = data.smallicon;

        request({
            method: "POST",
            uri: utils.urlstart,
            headers: { Authorization: utils.totalAuthString, "Content-Type": "application/json" },
            body: JSON.stringify(characterData),
            resolveWithFullResponse: true
        }).then(response => {
            if (response.statusCode >= 400) {
                console.log(response);
                returndata({error: "An error occurred between the server and the database"});
            } else {
                returndata({status: "Character created!", charid: charid});
            }
        }).catch(e => utils.quickErrorResponse(e, returndata));

    }).catch(e => utils.quickErrorResponse(e, returndata));

}

exports.editCharacter = function(data, session, returndata) {
    // Edit a character statblock or title
    // images are edited elsewhere
    // if we get a database conflict, do not resend- give an error and let the user deal with it

    // only users should be able to do this! Maybe admins can do this for everyone?
    if (!session.user || session.user.name != data.username) {
        returndata({error: "You do not have permission to edit that character"});
        return;
    }

    if (!data || !data.statBlock) {
        // TODO : more statblock verification
        returndata({error: "Missing statBlock"});
        return;
    }

    if (data.title && typeof data.title != "string") {
        returndata({error: 'Title is not a string object!'});
        return;
    }

    // locate the character
    request({
        method: "GET",
        uri: utils.urlstart + utils.designdoc + "/_view/character-by-user?key=\"" + session.user.name + "\"",
        headers: { Authorization: utils.totalAuthString },
        json: true
    }).then(cdat => {
        let charfound = false;
        for (let row of cdat.rows) {
            if (row.value.id == data.charactername) {
                charfound = true;
                let character = Object.assign({}, row.value);
                let chardbid = character._id;
                delete character._id;

                character.statBlock = data.statBlock;
                character.title = data.title;

                request({
                    method: "PUT",
                    uri: utils.urlstart + "/" + chardbid,
                    headers: { Authorization: utils.totalAuthString },
                    body: JSON.stringify(character),
                    resolveWithFullResponse: true
                }).then(response => {
                    if (response.statusCode == 409) {
                        // db conflict
                        returndata({error: "There was a database update conflict"});
                    } else if (response.statusCode >= 400) {
                        returndata({error: "There was an error between the server and the database"});
                        console.log(response);
                    } else {
                        returndata({status: "Character updated!"});
                    }
                }).catch(e => console.log(e.message));
            }
        }
        if (!charfound)
        returndata({error: "Could not find character under that user/id"});
    }).catch(e => utils.quickErrorResponse(e, returndata));
}