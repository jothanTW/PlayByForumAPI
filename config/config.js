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

exports.configs = JSON.parse(configstring);