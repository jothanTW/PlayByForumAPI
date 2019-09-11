module.exports = function(app) {
    let groupController = require('../controllers/testGroupController');
  
    app.route('/groups')
        .get(groupController.getGroupsData);
};