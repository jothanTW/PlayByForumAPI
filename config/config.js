let fs = require("fs");

let configstring = "";

try {
    configstring = fs.readFileSync("./config/config.json");
} catch (err) {
    console.log(err);
    if (err.code === "ENOENT") {
        console.log("Could not find config/config.json - are you sure you created it?");
    }
}
Object.assign(exports, JSON.parse(configstring))

let dbType = exports.dbtype;
// will mostly be returning the type
// mostly checking for valid types here
switch(dbType) {
    case 'couch':
    case 'mysql':
        exports.dbDirectory = dbType;
        console.log("Preparing " + dbType + " backend db config")
        break;
    default:
        throw "ERROR: unknown db type " + dbType + " in config file";
}