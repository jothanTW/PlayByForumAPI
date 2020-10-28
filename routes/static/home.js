module.exports = function(app) {
    let renderer = require('../../renders/home.render');
  
    app.route('/')
        .get(renderer.renderHomepage);

    app.route('/login')
        .get(renderer.renderLoginPage)
        .post(renderer.dologin);

    app.route('/forum/:forum')
        .get(renderer.renderForumPage);

    app.route('/thread/:thread/:page?')
        .get(renderer.renderThreadPage);

    app.route('/logout')
        .get(renderer.doLogout);

    app.route('/user/:user')
        .get(renderer.renderProfile);

    app.route('/user')
        .get(renderer.renderProfile);
};