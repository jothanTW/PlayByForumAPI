module.exports = function(app) {
    let adminController = require('../../controllers/couch/adminController');
  
    app.route('/admin/update-forum-counts')
        .put(adminController.setForumStats);

    app.route('/admin/update-thread-counts')
        .put(adminController.setThreadStats);
};