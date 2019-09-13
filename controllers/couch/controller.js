let configs = require("../../config/config.js");
let http = require("http");

const urlstart = configs.configs.dburl + "/" + configs.configs.dbname;
const designdoc = "/_design/forumdoc";
const authstring = configs.configs.dbuser + ":" + configs.configs.dbpass;

function quickErrorReturn(e) {
    console.log(e.message);
    // do something with the response
    res.send('{"error": "An error occured between the server and the database."}');
}

exports.getGroupsData = function(req, res) {
    let geturl = urlstart + designdoc + "/_view/groups-and-forums";
    let threadgeturl = urlstart + designdoc + "/_view/single-thread-stats";
    
    http.get(geturl, {auth: authstring}, rsp => {
        let rdat = '';
        rsp.on('data', d => rdat += d);
        rsp.on('end', () => {
            let jdat = JSON.parse(rdat);
            // we should be given an object with a "rows" array that contains group objects and the forums that belong to them
            // arrange them as an array of groups containing forums
            let senddat = [];
            let forums = [];
            let subforums = [];
            for (let row of jdat.rows) {
                if (row.value.type == "group") {
                    senddat.push({
                            title: row.value.title,
                            id: row.value.id,
                            priority: row.value.priority,
                            forums: []
                        });
                } else if (row.value.top) {
                    forums.push({
                        title: row.value.title,
                        id: row.value.id,
                        parent: row.value.parent,
                        threadnum: row.value.threadnum,
                        posts: row.value.posts,
                        priority: row.value.priority,
                        subforums: []
                    });
                } else {
                    subforums.push({
                        title: row.value.title,
                        id: row.value.id,
                        priority: row.value.priority,
                        parent: row.value.parent
                    })
                }
            }
            // put subforums in parent forums
            for (let sub of subforums) {
                // locate the parent
                let parenti = 0;
                for (; parenti < forums.length; parenti++) {
                    if (sub.parent == forums[parenti].id) {
                        break;
                    }
                }
                if (parenti < forums.length) { // found the parent
                    delete sub.parent;
                    forums[parenti].subforums.push(sub);
                }
            }

            // now add the forums to the proper groups
            for (let forum of forums) {
                // locate the parent
                let parenti = 0;
                for (; parenti < senddat.length; parenti++) {
                    if (forum.parent == senddat[parenti].id) {
                        break;
                    }
                }
                if (parenti < senddat.length) { // found the parent
                    delete forum.parent;
                    if (forum.subforums.length == 0)
                        delete forum.subforums;
                    senddat[parenti].forums.push(forum);
                }
            }

            // sort everything
            senddat.sort(function(a, b) { return a.priority - b.priority; });
            for (let group of senddat) {
                group.forums.sort(function(a, b) { return a.priority - b.priority; });
                for (let forum of group.forums) {
                    if (forum.subforums)
                        forum.subforums.sort(function(a, b) { return a.priority - b.priority; });
                }
            }

            res.send(senddat);
        });
    }).on('error', quickErrorReturn)
};

exports.getForumData = function(req, res) {
    let getsuperurl = urlstart + designdoc + "/_view/forums-by-parent";
    let geturl = urlstart + designdoc + "/_view/threads-by-parent";

    // get the full forum list to build the crumbs and subforums
    http.get(getsuperurl, {auth: authstring}, resp => {
        let rfData = '';
        resp.on('data', d => rfData += d);
        resp.on('end', () => {
            let jfData = JSON.parse(rfData);

            let allforums = {};
            let returnData = { id: req.params.forum, threads: [], subforums: [], crumbs: [] };

            for (let row of jfData.rows) {
                let value = row.value;
                allforums[value.id] = value;
                if (value.id == returnData.id) {
                    value.title = returnData.title;
                }
                if (value.parent == returnData.id) {
                    value.subforums.push({ 
                        title: value.title,
                        id: value.id,
                        posts: value.posts,
                        threadnum: value.threadnum,
                        subforums: []
                    });
                }
            }

            // search through each subforum and each other forum, see if they are related
            for (let sub of returnData.subforums) {
                let keys = Object.keys(allforums);
                for (let key of keys) {
                    if (allforums[key].parent == sub.id) {
                        sub.subforums.push({
                            id: key,
                            title: allforums[key].title
                        });
                    }
                }
                // delete empty arrays
                if (sub.subforums.length == 0) {
                    delete sub.subforums;
                }
            }
            if (returnData.subforums.length == 0) {
                delete returnData.subforums;
            }

            // add all crumbs
            if (!allforums[returnData.id].top) {
                returnData.crumbs.push({
                    id: allforums[returnData.id].parent,
                    title: allforums[allforums[returnData.id].parent].title
                });
                while (!allforums[returnData.crumbs[0].id].top) {
                    returnData.crumbs.unset({
                        id: allforums[returnData.crumbs[0].id].parent,
                        title: allforums[allforums[returnData.crumbs[0].id].parent].title
                    });
                }
            }

             // get all threads under parent
            let qstr = '?key="' + req.params.forum + '"';
            http.get(geturl + qstr, {auth: authstring}, rsp => {
                let rdat = '';
                rsp.on('data', d => rdat += d);
                rsp.on('end', () => {
                    let jdat = JSON.parse(rdat);

                    for (let row of jdat.rows) {
                        let value = row.value;
                        returnData.threads.push({
                            title: value.title,
                            id: value.id,
                            posts: value.posts,
                            views: value.views,
                            last: value.last,
                            date: value.date
                        })
                    }
                    // sort all subforums, sub-subforums, and threads
                    if (returnData.subforums) {
                        returnData.subforums.sort(function(a, b) { return a.priority = b.priority; });
                        for (let sub of returnData.subforums) {
                            if (sub.subforums) {
                                sub.sort(function(a, b) { return a.priority = b.priority; });
                            }
                        }
                    }
                    returnData.threads.sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime()});

                    res.send(returnData);
                });
            }).on('error', quickErrorReturn);
        })
    }).on('error', quickErrorReturn);



    // get all stats under each thread found

    // organize threads by last post date
}

exports.setThreadStats = function(req, res) {
    let getstaturl = urlstart + designdoc + "/_view/single-thread-stats";
    let posturl = urlstart + "/";

    // get each thread block, copy over the posts, last, and last date values, make sure the views value exists
    http.get(getstaturl, {auth: authstring}, rsp => {
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
                    let prequest = http.request(posturl + senddat._id + "/", {auth: authstring, method: "PUT"}, rsp3 => {
                        if (rsp3.statusCode >= 400) {
                            console.log("update for thread " + senddat.title + " failed with status code " + rsp3.statusCode);
                        } else {
                            console.log("update for thread " + senddat.title + " complete.");
                        }
                    }).on('error', quickErrorReturn);
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
    }).on('error', quickErrorReturn);
}

exports.setForumStats = function(req, res) {
    let geturl = urlstart + designdoc + "/_view/forums-by-parent";
    let getstaturl = urlstart + designdoc + "/_view/single-thread-stats";
    let posturl = urlstart + "/";

    console.log("Setting forum stats...");

    // get each forum and thread stat block
    http.get(geturl, {auth: authstring}, rsp => {
        let rtData = '';
        rsp.on('data', d => rtData += d);
        rsp.on('end', () => {
            let jtData = JSON.parse(rtData);
            http.get(getstaturl, {auth: authstring}, rsp2 => {
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
                            let prequest = http.request(posturl + forums[key]._id + "/", {auth: authstring, method: "PUT"}, rsp3 => {
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
            }).on('error', quickErrorReturn);
        });
    }).on('error', quickErrorReturn);
}