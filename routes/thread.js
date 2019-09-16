module.exports = function(app) {
    let threadController = require('../controllers/couch/controller');
  
    app.route('/thread/:thread/:page?')
        .get(threadController.getThreadData);

    app.route('/thread/:thread')
        .post(threadController.makePost);
};