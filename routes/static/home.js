module.exports = function(app) {
    let renderer = require('../../renders/home.render');
    let configs = require('../../config/config');
    let utils = require('../../controllers/' + configs.dbDirectory + '/controllerUtils');
    let userController = require('../../controllers/' + configs.dbDirectory + '/userController');
  
    app.route('/')
        .get(renderer.renderHomepage);

    app.route('/login')
        .get(renderer.renderLoginPage)
        .post(renderer.dologin);
    
    app.route('/register')
        .post(renderer.doRegister);

    app.route('/forum/:forum/new-thread')
        .get(renderer.getCreateThreadPage)
        .post();

    app.route('/forum/:forum/:page?')
        .get(renderer.renderForumPage)
        .post(renderer.postThread);

    app.route('/thread/:thread/post')
        .post(renderer.makePost);

    app.route('/thread/:thread/:page?')
        .get(renderer.renderThreadPage);

    app.route('/logout')
        .get(renderer.doLogout);

    app.route('/user/:user')
        .get(renderer.renderProfile)
        .put(utils.createResponseFunction(userController.editUser));

    app.route('/user')
        .get(renderer.renderProfile);

    app.route('/icon/:file')
        .get(userController.getIconData);

    app.route('/icon/:character?')
        .put(utils.createResponseFunction(userController.putIcon));
};