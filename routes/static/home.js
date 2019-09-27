module.exports = function(app) {
    let renderer = require('../../renders/home.render');
  
    app.route('/')
        .get(renderer.renderHomepage);

};