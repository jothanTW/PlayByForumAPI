let fs = require('fs');

exports.getData = function(req, res) {
    fs.readFile("./pages/home.html", "utf8", (err, data) => {
        res.send(data);
        // need to do error handling
    });
};