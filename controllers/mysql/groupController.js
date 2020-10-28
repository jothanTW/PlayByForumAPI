let utils = require("./controllerUtils");

exports.getGroupsData = function(data, session, returndata) {
    utils.getForumHierarchy(returndata);
}