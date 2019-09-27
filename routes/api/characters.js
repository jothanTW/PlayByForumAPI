module.exports = function(app) {
    let charController = require('../../controllers/couch/characterController');
    let utils = require("../../controllers/couch/controllerUtils");
    
    app.route('/user/:username/character/:charactername')
        .get(utils.createResponseFunction(charController.getCharacter))
        .put(utils.createResponseFunction(charController.editCharacter));
    
    app.route('/user/:username/character')
        .get(utils.createResponseFunction(charController.getAllCharacters))
        .post(utils.createResponseFunction(charController.addCharacter));
};