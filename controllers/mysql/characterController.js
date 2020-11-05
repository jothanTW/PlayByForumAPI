let configs = require("../../config/config.js");
let request = require("request-promise-native");

let utils = require("./controllerUtils");

let Character = require("../../models/character");

let msqlcon = utils.connection;

// CHARACTER IDS ARE STORED AS KEBABS

exports.getCharacter = function(data, session, returndata) {
    // assume each character has a unique name under each player
    msqlcon.query("select characters.id, characters.name, characters.title, characters.av, characters.statblock, characters.bio, characters.system " +
                "from characters " +
                "join users on users.pkey = characters.user " +
                "where characters.id = ? and users.userid = ?;", [data.charactername, data.username], (e, r, f) => {
        if (e) {
            console.log(e);
            returndata({error: "There was a server error getting the character"});
            return;
        }
        if (r.length == 0) {
            returndata({error: "The specified character could not be found"});
            return;
        }
        if (r.length > 1) {
            console.log("multiple characters under user " + data.username + " found with character id " + data.charactername);
            returndata({error: "There was a server error getting the character"});
            return;
        }
        let foundCharacter = new Character(0, r[0].id, r[0].name, data.username, r[0].title, r[0].av);
        try {
            foundCharacter.statBlock = JSON.parse(r[0].statblock);
        } catch (e) {
            console.log("Invalid statblock on character " + data.charactername + " under user " + data.username);
        }
        foundCharacter.bio = r[0].bio;
        if (r[0].system)
            foundCharacter.system = r[0].system;
        returndata({status: "Character retrieved", character: foundCharacter});
    });
}

exports.getAllCharacters = function(data, session, returndata) {
    msqlcon.query("select characters.id, characters.name, characters.title, characters.av, characters.statblock, characters.bio, characters.system " +
                "from characters " +
                "join users on users.pkey = characters.user " +
                "where users.userid = ?;", [data.username], (e, r, f) => {
        if (e) {
            console.log(e);
            returndata({error: "There was a server error getting the character"});
            return;
        }
        let characters = [];
        for (let i = 0; i < r.length; i++) {
            let foundCharacter = new Character(0, r[i].id, r[i].name, data.username, r[i].title, r[i].av);
            try {
                foundCharacter.statBlock = JSON.parse(r[i].statblock);
            } catch (e) {
                console.log("Invalid statblock on character " + data.charactername + " under user " + data.username);
            }
            foundCharacter.bio = r[i].bio;
            if (r[i].system)
                foundCharacter.system = r[i].system;
            characters.push(foundCharacter);
        }
        returndata({status: characters.length + " character" + (characters.length == 1 ? '' : 's') + " found", characters: characters});
    });
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

    // check if the character exists under this user
    // this might need a transaction, but if the sessions are right, it shouldn't?
    msqlcon.query("select characters.id, characters.name, characters.title, characters.av, characters.statblock, characters.bio " +
                "from characters " +
                "join users on users.pkey = characters.user " +
                "where characters.id = ? and users.userid = ?;", [charid, session.user.name], (e, r, f) => {
        if (e) {
            console.log(e);
            returndata({error: "There was a server error creating the character"});
            return;
        }
        if (r.length > 0) {
            returndata({error: "Character by that name already exists!"});
            return;
        }
        let charArgs = [session.user.dbid, charid, data.characterName, "", null, data.statBlock, "", ""];
        if (data.title && typeof data.title == "string") charArgs[3] = data.title;
        if (data.icon && typeof data.icon == "string") charArgs[4] = data.icon;
        if (data.bio && typeof data.bio == "string") charArgs[6] = data.bio;
        if (data.system && typeof data.system == "string") charArgs[7] = data.system;

        msqlcon.query("insert into characters (user, id, name, title, av, statblock, bio, system) values (?, ?, ?, ?, ?, ?, ?, ?)", charArgs, (e2, r2, f2) => {
            if (e2) {
                console.log(e2);
                returndata({error: "There was a server error creating the character"});
                return;
            }
            returndata({status: "Character created!", charid: charid});
        });
    });
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