module.exports = function(app) {
    let fs = require('fs');


    app.route('/style/:file')
        .get((req, res) => {
            fs.readFile("./pages/css/" + req.params.file, 'utf8', (err, data) => {
                if (err) {
                    res.status(404).send("file not found");
                } else {
                    res.set('Content-type', 'text/css');
                    res.send(data);
                }
            });
        });

    app.route('/script/:file')
        .get((req, res) => {
            fs.readFile("./pages/js/" + req.params.file, 'utf8', (err, data) => {
                if (err) {
                    res.status(404).send("file not found");
                } else {
                    res.set('Content-type', 'text/javascript');
                    res.send(data);
                }
            });
        })
}