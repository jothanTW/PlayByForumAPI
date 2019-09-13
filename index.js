var express = require("express"),
    app = express(),
    port = process.env.PORT || 3000;

    
let cors = require('cors');
app.use(cors());

let groupRoutes = require("./routes/groups");
let forumRoutes = require("./routes/forum");
let threadRoutes = require("./routes/thread");
let adminRoutes = require("./routes/admin");
let defaultRoute = require("./routes/default");

adminRoutes(app);
defaultRoute(app);
groupRoutes(app);
forumRoutes(app);
threadRoutes(app);


app.listen(port);

console.log('pbforum REST server now listening on: ' + port);