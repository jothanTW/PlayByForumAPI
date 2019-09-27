module.exports = function(app) {
    let defaultController = require('../../controllers/defaultController');
  
    app.route('/')
        .get(defaultController.getData)
        .head(defaultController.getHead);
};