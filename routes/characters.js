module.exports = function(app) {
    let charController = require('../controllers/couch/characterController');
    
    app.route('/user/:username/character/:charactername')
        .get(charController.getCharacter);
    
    app.route('/user/:username/character')
        .get(charController.getAllCharacters);

    app.route('/user/:username/character/')
        .post(charController.addCharacter);

    app.route('/user/:username/character/:charactername')
        .put(charController.editCharacter);
};