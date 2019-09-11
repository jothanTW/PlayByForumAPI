let fs = require('fs');

exports.getForumData = function(req, res) {
    // req.params.forum and req.params.page should be read in for real data
    fs.readFile("./testdata/forum-test.json", "utf8", (err, data) => {
        res.send(data);
        // need to do error handling
    });
};