module.exports = function(app) {
    let threadController = require('../controllers/testThreadController');
  
    app.route('/thread/:thread/:page?')
        .get(threadController.getThreadData);
};