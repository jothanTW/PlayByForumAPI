let fs = require('fs');

exports.getData = function(req, res) {
    fs.readFile("./pages/home.html", "utf8", (err, data) => {
        res.send(data);
        // need to do error handling
    });
};

exports.getHead = function(req, res) {
    // add more headers if needed
    res.send();
}

exports.getIconData = function(req, res) {
    // nothing fancy, just provide the specified file
    fs.readFile("./icons/" + req.params.file, (err, data) => {
        if (err) {
            res.status(404).send('Not found');
            return;
        }
        let fileformat = filetype(data);
        res.set('Content-type', fileformat.mime);
        res.send(data);
    });
}

exports.getHtmlData = function(req, res) {
    fs.readFile("./pages/" + req.params.file, (err, data) => {
        if (err) {
            res.status(404).send('Not found');
            return;
        }
        res.send(data);
    });
}