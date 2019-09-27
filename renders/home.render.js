let ejs = require("ejs");
let controller = require("../controllers/couch/groupController");

exports.renderHomepage = function(req, res) {
    // get the groups data
    controller.getGroupsData({}, {}, data => {
        //console.log(data);
        ejs.renderFile("./pages/ejs/home.ejs", {data: data}, (err, str) => {
            if (err) {
                console.log(err);
                res.status(500).send("There was an error loading the file for this page");
            } else {
                res.send(str);
            }
        });
    });
}