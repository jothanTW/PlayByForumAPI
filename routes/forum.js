module.exports = function(app) {
    let forumController = require('../controllers/couch/controller');
  
    app.route('/forum/:forum/:page?')
        .get(forumController.getForumData);

    app.route('/forum/:forum')
        .post(forumController.makeThread);
};