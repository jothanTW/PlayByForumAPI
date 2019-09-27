module.exports = function(app) {
    let forumController = require('../../controllers/couch/forumController');
    let utils = require("../../controllers/couch/controllerUtils");
  
    app.route('/forum/:forum/:page?')
        .get(utils.createResponseFunction(forumController.getForumData));

    app.route('/forum/:forum')
        .post(utils.createResponseFunction(forumController.makeThread));
};