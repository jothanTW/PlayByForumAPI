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
    secret: configs.cookiesecret,
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

let loginRoutes = require("./routes/api/login");
let groupRoutes = require("./routes/api/groups");
let forumRoutes = require("./routes/api/forum");
let threadRoutes = require("./routes/api/thread");
let adminRoutes = require("./routes/api/admin");
let defaultRoute = require("./routes/api/default");
let characterRoute = require("./routes/api/characters");

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
        key: fs.readFileSync(configs.certkey),
        cert: fs.readFileSync(configs.cert)
      }, restapp).listen(restportSec);
      console.log("pbforum secure REST server now listening on: " + restportSec);
} catch (e) {
    console.warn("Could not start HTTPS REST service: " + e);
}


// setup the static pages
let staticapp = express();
staticapp.use(bodyparser.json());
staticapp.use(bodyparser.urlencoded({ extended: true }));

let staticport = 8000;
let staticportSec = 8443;

staticapp.set("view engine", "ejs");
staticapp.set('views', './pages/ejs');

staticapp.use(cors({
  exposedHeaders: ['Set-Cookie'], credentials: true, origin: function (origin, callback) { callback(null, true)}
}));

staticapp.use(session({
  key: configs.cookiename,
  secret: configs.cookiesecret,
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

// try to put some globals into ejs?
staticapp.use((req, res, next) => {
  if (req.session.user) {
    res.locals.username = req.session.user.name;
  } else {
    res.locals.username = null;
  }
  next();
})

staticapp.locals.imgpath = "/icon/";
staticapp.locals.maxCharacters = configs.maxCharsPerUser;
staticapp.locals.maxThreadTitleLength = configs.maxThreadTitleLength;
staticapp.locals.maxPostLength = configs.maxPostLength;

let staticGroupRoute = require('./routes/static/home');
let staticFileRoute = require('./routes/static/file');

staticGroupRoute(staticapp);
staticFileRoute(staticapp);

staticapp.listen(staticport);

console.log('pbforum static server now listening on: ' + staticport);