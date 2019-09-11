module.exports = function(app) {
    let forumController = require('../controllers/testForumController');
  
    app.route('/forum/:forum/:page?')
        .get(forumController.getForumData);
};