let configs = require("./config/config");
let fs = require("fs");

let express = require("express");
let restapp = express();
let restport = 3000;
let restportSec = 3443;

let session = require('express-session');
let bodyparser = require('body-parser');
restapp.use(bodyparser.json());

let https = require('https');
    
let cors = require('cors');
restapp.use(cors({
    exposedHeaders: ['Set-Cookie'], credentials: true, origin: function (origin, callback) { callback(null, true)}
  }));

  restapp.use(session({
    key: 'pbforum_sid',
    secret: configs.configs.cookiesecret,
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

adminRoutes(restapp);
defaultRoute(restapp);
loginRoutes(restapp);
groupRoutes(restapp);
forumRoutes(restapp);
threadRoutes(restapp);
characterRoute(restapp);


restapp.listen(restport);

console.log('pbforum REST server now listening on: ' + restport);

try {
    https.createServer({
        key: fs.readFileSync(configs.configs.certkey),
        cert: fs.readFileSync(configs.configs.cert)
      }, restapp).listen(restportSec);
      console.log("pbforum secure REST server now listening on: " + restportSec);
} catch (e) {
    console.warn("Could not start HTTPS REST service: " + e);
}