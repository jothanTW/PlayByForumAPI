let configs = require("../../config/config.js");

module.exports = function(app) {
    let loginController = require('../../controllers/' + configs.dbDirectory + '/userController');
    let utils = require("../../controllers/" + configs.dbDirectory + "/controllerUtils");
  
    app.route('/logout')
        .put(utils.createResponseFunction(loginController.doLogout));

    app.route('/login')
        .put(utils.createResponseFunction(loginController.doLogin));

    app.route('/newuser')
        .put(utils.createResponseFunction(loginController.doSignUp));
    
    app.route('/user')
        .get(utils.createResponseFunction(loginController.checkSession));

    app.route('/icon/:file')
        .get(loginController.getIconData)

    app.route('/icon/:character?')
        .put(utils.createResponseFunction(loginController.putIcon));
    
    app.route('/user/:user')
        .get(utils.createResponseFunction(loginController.getUserProfile))
        .put(utils.createResponseFunction(loginController.editUser));
};