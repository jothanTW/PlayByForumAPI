let fs = require('fs');

exports.getGroupsData = function(req, res) {
    fs.readFile("./testdata/group-test.json", "utf8", (err, data) => {
        res.send(data);
        // need to do error handling
    });
};