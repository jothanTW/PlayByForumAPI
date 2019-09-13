module.exports = function(app) {
    let threadController = require('../controllers/test/controller');
  
    app.route('/thread/:thread/:page?')
        .get(threadController.getThreadData);
};