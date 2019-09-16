module.exports = function(app) {
    let loginController = require('../controllers/couch/userController');
  
    app.route('/logout')
        .put(loginController.doLogout);

    app.route('/login')
        .put(loginController.doLogin);

    app.route('/newuser')
        .put(loginController.doSignUp);
    
    app.route('/user')
        .get(loginController.checkSession);
};