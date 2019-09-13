module.exports = function(app) {
    let groupController = require('../controllers/couch/controller');
  
    app.route('/groups')
        .get(groupController.getGroupsData);
};