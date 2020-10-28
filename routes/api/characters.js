module.exports = function(app) {
    let configs = require("../../config/config.js");
    let charController = require('../../controllers/' + configs.dbDirectory + '/characterController');
    let utils = require("../../controllers/" + configs.dbDirectory + "/controllerUtils");
    
    app.route('/user/:username/character/:charactername')
        .get(utils.createResponseFunction(charController.getCharacter))
        .put(utils.createResponseFunction(charController.editCharacter));
    
    app.route('/user/:username/character')
        .get(utils.createResponseFunction(charController.getAllCharacters))
        .post(utils.createResponseFunction(charController.addCharacter));
};