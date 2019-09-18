# The Play-By-Forum API (Under NodeJS)

This is a REST backend for the Play-By-Forum framework. It's written in NodeJS, and therefore requires npm to run. It should normally be attached to a database; the current configuration attaches it to a couchdb JSON document store, but other databases can be used by defining a different controller that fufills all the defined routes.

This project requires a **config.json** file to be placed in the ./config/ folder; which is excluded by .gitignore. It is expected to include the database location and the database authentication, but since it's generally only used by the controller files, it can contain arbitrary data specific to the database needs.

## Project setup
```
npm install
```

### Open the server
```
npm run start
```
