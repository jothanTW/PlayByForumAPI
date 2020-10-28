module.exports = function(app) {
    let configs = require("../../config/config.js");
    let threadController = require('../../controllers/' + configs.dbDirectory + '/threadController');
    let utils = require("../../controllers/" + configs.dbDirectory + "/controllerUtils");
  
    app.route('/thread/:thread/:page?')
        .get(utils.createResponseFunction(threadController.getThreadData));

    app.route('/thread/:thread')
        .post(utils.createResponseFunction(threadController.makePost));

    app.route('/thread/:thread/:post')
        .put(utils.createResponseFunction(threadController.editPost));

    app.route('/thread/:thread/map')
        .post(utils.createResponseFunction(threadController.addMap));

    app.route('/thread/:thread/character')
        .post(utils.createResponseFunction(threadController.addCharacterToThread));
};