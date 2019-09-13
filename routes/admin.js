module.exports = function(app) {
    let adminController = require('../controllers/couch/controller');
  
    app.route('/admin/update-forum-counts')
        .post(adminController.setForumStats);

    app.route('/admin/update-thread-counts')
        .post(adminController.setThreadStats);
};