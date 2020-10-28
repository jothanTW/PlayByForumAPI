// these should all be req/res functions, and not use the database

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