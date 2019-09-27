let configs = require("../../config/config.js");
let http = require("http");
let request = require("request-promise-native");

let utils = require("./controllerUtils");

exports.setThreadStats = function(req, res) {
    let getstaturl = utils.urlstart + utils.designdoc + "/_view/single-thread-stats";
    let posturl = utils.urlstart + "/";

    // get each thread block, copy over the posts, last, and last date values, make sure the views value exists
    http.get(getstaturl, {auth: utils.authstring}, rsp => {
        let rtData = '';
        rsp.on('data', d => rtData += d);
        rsp.on('end', () => {
            let jtData = JSON.parse(rtData).rows[0].value;
            let upNum = 0;

            let keys = Object.keys(jtData);
            for (let key of keys) {
                let tdata = jtData[key];
                let senddat = Object.assign({}, tdata.thread);
                let doSend = false;
                if (tdata.posts != senddat.posts) {
                    senddat.posts = tdata.posts;
                    doSend = true;
                }
                if (tdata.last != senddat.last) {
                    senddat.last = tdata.last;
                    doSend = true;
                } 
                if (tdata.date != senddat.date) {
                    senddat.date = tdata.date;
                    doSend = true;
                }
                if (!(tdata.thread.views > -1)) {
                    senddat.views = 0;
                    doSend = true;
                }

                if (doSend) {
                    console.log("Updating counts for thread " + senddat.title + "...");
                    upNum++;
                    let prequest = http.request(posturl + senddat._id + "/", {auth: utils.authstring, method: "PUT"}, rsp3 => {
                        if (rsp3.statusCode >= 400) {
                            console.log("update for thread " + senddat.title + " failed with status code " + rsp3.statusCode);
                        } else {
                            console.log("update for thread " + senddat.title + " complete.");
                        }
                    }).on('error', e => utils.quickErrorReturn(e, res));
                    delete senddat._id;
                    prequest.write(JSON.stringify(senddat));
                    prequest.end();
                }
            }

            if (upNum == 0) {
                console.log("All threads up to date");
            }

            res.send('{ "updatedThreads" : ' + upNum + ' }');
        });
    }).on('error', e => utils.quickErrorReturn(e, res));
}

exports.setForumStats = function(req, res) {
    let geturl = utils.urlstart + utils.designdoc + "/_view/forums-by-parent";
    let getstaturl = utils.urlstart + utils.designdoc + "/_view/single-thread-stats";
    let posturl = utils.urlstart + "/";

    console.log("Setting forum stats...");

    // get each forum and thread stat block
    http.get(geturl, {auth: utils.authstring}, rsp => {
        let rtData = '';
        rsp.on('data', d => rtData += d);
        rsp.on('end', () => {
            let jtData = JSON.parse(rtData);
            http.get(getstaturl, {auth: utils.authstring}, rsp2 => {
                let rsData = '';
                rsp2.on('data', d => rsData += d);
                rsp2.on('end', () => {
                    let jsData = JSON.parse(rsData);

                    console.log("threadcount: fetched " + jtData.rows.length + " forums and " + jsData.rows.length + " threads");

                    // set each thread to 0
                    let forums = {};
                    let fmetas = {};
                    for (let row of jtData.rows) {
                        let f = Object.assign({}, row.value);
                        fmetas[f.id] = { threadnum: f.threadnum, posts: f.posts };
                        f.threadnum = 0;
                        f.posts = 0;
                        forums[f.id] = f;
                    }
                    // go through each thread stat block, adding stats to its parent
                    let threadkeys = Object.keys(jsData.rows[0].value);
                    for (let threadkey of threadkeys) {
                        let s = jsData.rows[0].value[threadkey];
                        if (forums[s.thread.parent]) {
                            forums[s.thread.parent].threadnum++;
                            forums[s.thread.parent].posts += s.posts;
                        }
                    }
                    // all threads should be updated. send them back if they're changed.

                    let upNum = 0;

                    let keys = Object.keys(forums);
                    for (let key of keys) {
                        if (forums[key].threadnum != fmetas[key].threadnum || forums[key].posts != fmetas[key].posts) {
                            console.log("Updating counts for forum " + forums[key].title + "...");
                            upNum++;
                            let prequest = http.request(posturl + forums[key]._id + "/", {auth: utils.authstring, method: "PUT"}, rsp3 => {
                                if (rsp3.statusCode >= 400) {
                                    console.log("update for forum " + forums[key].title + " failed with status code " + rsp3.statusCode);
                                } else {
                                    console.log("update for forum " + forums[key].title + " complete.");
                                }
                            }).on('error', quickErrorReturn);
                            delete forums[key]._id;
                            prequest.write(JSON.stringify(forums[key]));
                            prequest.end();
                        }
                    }

                    if (upNum == 0) {
                        console.log("All forums up to date");
                    }

                    res.send('{ "updatedForums" : ' + upNum + ' }');

                });
            }).on('error',  e => utils.quickErrorReturn(e, res));
        });
    }).on('error',  e => utils.quickErrorReturn(e, res));
}