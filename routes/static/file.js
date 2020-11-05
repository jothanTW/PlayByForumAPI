module.exports = function(app) {
    let fs = require('fs');
    let sass = require('node-sass');

    app.route('/scss')
        .get((req, res) => {
            sass.render({file: './pages/scss/main.scss'}, (err, data) => {
                if (err) {
                    console.log(err);
                    res.status(500).send("file could not be loaded");
                    return;
                }
                res.set('Content-type', 'text/css');
                res.send(data.css);
            });
        });

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