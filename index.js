let express = require("express"),
    app = express(),
    port = process.env.PORT || 3000;

let session = require('express-session');
let bodyparser = require('body-parser');
app.use(bodyparser.json());

let https = require('https');
    
let cors = require('cors');
app.use(cors({
    exposedHeaders: ['Set-Cookie'], credentials: true, origin: function (origin, callback) { callback(null, true)}
  }));

app.use(session({
    key: 'pbforum_sid',
    secret: 'abigolsecret',
    resave: false,
    saveUninitialized: false,
    credentials: true,
    rolling: true,
    cookie: {
        maxAge: 31536000000, // ~one year
        sameSite: 'lax',
        httpOnly: false
    }
}));

let loginRoutes = require("./routes/login");
let groupRoutes = require("./routes/groups");
let forumRoutes = require("./routes/forum");
let threadRoutes = require("./routes/thread");
let adminRoutes = require("./routes/admin");
let defaultRoute = require("./routes/default");
let characterRoute = require("./routes/characters");

adminRoutes(app);
defaultRoute(app);
loginRoutes(app);
groupRoutes(app);
forumRoutes(app);
threadRoutes(app);
characterRoute(app);


app.listen(port);

console.log('pbforum REST server now listening on: ' + port);