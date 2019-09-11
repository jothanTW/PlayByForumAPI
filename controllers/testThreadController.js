let fs = require('fs');

exports.getThreadData = function(req, res) {
    fs.readFile("./testdata/thread-test.json", "utf8", (err, data) => {
        res.send(data);
        // need to do error handling
    });
};