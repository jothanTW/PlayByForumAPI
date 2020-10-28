module.exports = function(app) {
    let configs = require("../../config/config.js");
    let adminController = require('../../controllers/' + configs.dbDirectory + '/adminController');
  
    app.route('/admin/update-forum-counts')
        .put(adminController.setForumStats);

    app.route('/admin/update-thread-counts')
        .put(adminController.setThreadStats);
};