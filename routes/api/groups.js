module.exports = function(app) {
    let configs = require("../../config/config.js");
    let groupController = require('../../controllers/' + configs.dbDirectory + '/groupController');
    let utils = require("../../controllers/" + configs.dbDirectory + "/controllerUtils");
    app.route('/groups')
        //.get(groupController.getGroupsData);
        .get(utils.createResponseFunction(groupController.getGroupsData));
};