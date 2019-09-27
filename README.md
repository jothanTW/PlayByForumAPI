# The Play-By-Forum API (Under NodeJS)

This is a REST backend for the Play-By-Forum framework. It's written in NodeJS, and therefore requires npm to run. It should normally be attached to a database; the current configuration attaches it to a couchdb JSON document store, but other databases can be used by defining a different controller that fufills all the defined routes.

This project requires a **config.json** file to be placed in the ./config/ folder; which is excluded by .gitignore. It is expected to include the database location, the database name, the database authentication, the controller type, and the https certs, as well as any database-specific information.

The backend opens ports on 3000 and 3443, one for http connections and one for https. The https connection looks for certificates and keys from the location given by the config file, which are generally expected in the certs folder, whose contents are excluded by gitignore. 

This backend is also intended to support a static website, available on ports 8000 and 8443, though this is barely implemented. This backend uses the same controllers that the REST backend uses, and builds ejs pages to send to the user. URLs and pages are largely the same.

## Project setup
```
npm install
```

### Open the server
```
npm run start
```
