var gutil = require('gulp-util'),
    map = require('vinyl-map'),
    https = require('https'),
    Q = require('q'),
    fs = require("q-io/fs");

var PluginError = gutil.PluginError;

// consts
const PLUGIN_NAME = 'gulp-gist';

// Remove indent from the left, aligning everything with the first line
function leftAlign(lines) {
    if (lines.length == 0) return lines;
    var distance = lines[0].match(/^\s*/)[0].length;
    var result = [];
    lines.forEach(function(line){
        result.push(line.slice(Math.min(distance, line.match(/^\s*/)[0].length)));
    });
    return result;
}

function getUserHome() {
    return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}

function create(auth, files) {
    var done = Q.defer();

    var data = JSON.stringify({
        public: true,
        files: files
    });
    var len = Object.keys(files).length;
    gutil.log("Push " + len + " file" + (len === 1 ? '' : 's') + " to new gist");
    var body = "";
    var req = https.request({
        "host": "api.github.com",
        "path": "/gists",
        "method": "POST",
        "headers": {
            'User-Agent': 'prismicdeveloper',
            'Authorization': 'Basic ' + new Buffer(auth).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        }
    });
    req.write(data);
    req.end();
    req.on("data", function (chunk) {
        body += chunk;
    });
    req.on("end", function() {
        gutil.log("Done creating ", files);
        done.resolve(body);
    });
    req.on("error", function (error) {
        gutil.log('Gist error ' + error);
        done.reject(error);
    });
    return done.promise;
}

function patch(auth, id, files) {
    var done = Q.defer();

    var data = JSON.stringify({
        files: files
    });
    var len = Object.keys(files).length;
    gutil.log("Push " + len + " file" + (len === 1 ? '' : 's') + " to gist " + id);
    var req = https.request({
        "host": "api.github.com",
        "path": "/gists/" + id,
        "method": "PATCH",
        "headers": {
            'User-Agent': 'prismicdeveloper',
            'Authorization': 'Basic ' + new Buffer(auth).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        }
    }, function (res) {
        gutil.log('Gist response ' + res.statusCode + ' for gist ' + id);
        done.resolve(res);
    });
    req.write(data);
    req.end();
    req.on("error", function (error) {
        gutil.log('Gist error ' + error);
        done.reject(error);
    });
    return done.promise;
}

// plugin level function (dealing with files)
var gulpGist = function(args) {
    var mode = (args && args['mode']) || 'update';
    return map(function(code, filename) {
        var lines = code.toString().split("\n");
        var gists = {};
        var currentGist = null;
        var lineNo = 0;
        lines.forEach(function(line) {
            if (line.indexOf("// startgist:") > -1 || line.indexOf("# startgist:") > -1) {
                if (currentGist) {
                    throw new PluginError(PLUGIN_NAME, filename + ":" + lineNo + ": Unexpected startgist: a previous gist was not closed");
                }
                currentGist = {
                    "id": line.split(":")[1].trim(),
                    "filename": line.split(":")[2].trim(),
                    "lines": []
                };
            } else if (line.indexOf("// endgist") > -1 || line.indexOf("# endgist") > -1) {
                if (!currentGist) {
                    throw new PluginError(PLUGIN_NAME, filename + ":" + lineNo + " Unexpected endgist: missing startgist earlier");
                }
                if (!gists[currentGist.id]) {
                    gists[currentGist.id] = {};
                }
                gists[currentGist.id][currentGist.filename] = {
                    'content': leftAlign(currentGist.lines).join("\n")
                };
                currentGist = null;
            } else if (currentGist && line.indexOf("gisthide") == -1) {
                currentGist.lines.push(line);
            }
            lineNo += 1;
        });
        if (currentGist) {
            throw new PluginError(PLUGIN_NAME, "Reached end of file but gist is still open");
        }
        if (mode == 'create') {
            return fs.read(getUserHome() + '/.gistauth', 'b').then(function (auth) {
                return Q.all(Object.keys(gists).map(function(id) {
                    return create(auth, gists[id]);
                }));
            }).done();
        } else if (mode == 'update') {
            return fs.read(getUserHome() + '/.gistauth', 'b').then(function (auth) {
                return Q.all(Object.keys(gists).map(function(id) {
                    return patch(auth, id, gists[id]);
                }));
            }).done();
        } else {
            gutil.log('Gist mock: ', gists);
        }
    });
};

// exporting the plugin main function
module.exports = gulpGist;
