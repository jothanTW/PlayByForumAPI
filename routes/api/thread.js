module.exports = function(app) {
    let threadController = require('../../controllers/couch/threadController');
    let utils = require("../../controllers/couch/controllerUtils");
  
    app.route('/thread/:thread/:page?')
        .get(utils.createResponseFunction(threadController.getThreadData));

    app.route('/thread/:thread')
        .post(utils.createResponseFunction(threadController.makePost));

    app.route('/thread/:thread/:post')
        .put(utils.createResponseFunction(threadController.editPost));

    app.route('/thread/:thread/map')
        .post(utils.createResponseFunction(threadController.addMap));
};