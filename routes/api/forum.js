module.exports = function(app) {
    let configs = require("../../config/config.js");
    let forumController = require('../../controllers/' + configs.dbDirectory + '/forumController');
    let utils = require("../../controllers/" + configs.dbDirectory + "/controllerUtils");
  
    app.route('/forum/:forum/:page?')
        .get(utils.createResponseFunction(forumController.getForumData));

    app.route('/forum/:forum')
        .post(utils.createResponseFunction(forumController.makeThread));
};