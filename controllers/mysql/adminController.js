let configs = require("../../config/config.js");

let utils = require("./controllerUtils");

exports.setThreadStats = function(req, res) {
    res.send('{ "updatedThreads" : ' + 0 + ' }');
}

exports.setForumStats = function(req, res) {
    res.send('{ "updatedForums" : ' + 0 + ' }');
}