var gutil = require('gulp-util'),
    map = require('vinyl-map'),
    https = require('https'),
    throat = require('throat'), // Number of max simultaneous requests
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

// Send patch to Github and return a promise of result
function patch(auth, gist) {
    var done = Q.defer();

    var json = {
        files: {}
    };
    json.files[gist.filename] = {
        'content': leftAlign(gist.lines).join("\n")
    };
    var data = JSON.stringify(json);
    gutil.log("Push gist " + gist.id);
    var req = https.request({
        "host": "api.github.com",
        "path": "/gists/" + gist.id,
        "method": "PATCH",
        "headers": {
            'User-Agent': 'erwan',
            'Authorization': 'Basic ' + new Buffer(auth).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        }
    }, function (res) {
        gutil.log('Gist response ' + res.statusCode + ' for gist ' + gist.id);
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
var gulpGist = function() {
    return map(function(code, filename) {
        var lines = code.toString().split("\n");
        var gists = [];
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
                gists.push(currentGist);
                currentGist = null;
            } else if (currentGist && line.indexOf("gisthide") == -1) {
                currentGist.lines.push(line);
            }
            lineNo += 1;
        });
        if (currentGist) {
            throw new PluginError(PLUGIN_NAME, "Reached end of file but gist is still open");
        }
        return fs.read(getUserHome() + '/.gistauth', 'b').then(function (auth) {
            return Q.all(gists.map(function(gist){
                return patch(auth, gist);
            }));
        }).done();
    });
};

// exporting the plugin main function
module.exports = gulpGist;
