module.exports = function(app) {
    let groupController = require('../../controllers/couch/groupController');
    let utils = require("../../controllers/couch/controllerUtils");
    app.route('/groups')
        //.get(groupController.getGroupsData);
        .get(utils.createResponseFunction(groupController.getGroupsData));
};