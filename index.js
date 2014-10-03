var gutil = require('gulp-util'),
    map = require('vinyl-map'),
    https = require('https'),
    fs = require('fs');

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

// plugin level function (dealing with files)
var gulpGist = function() {
    return map(function(code, filename) {
        var lines = code.toString().split("\n");
        var gists = [];
        var currentGist = null;
        var lineNo = 0;
        lines.forEach(function(line) {
            if (line.indexOf("// startgist:") === 0) {
                if (currentGist) {
                    throw new PluginError(PLUGIN_NAME, filename + ":" + lineNo + ": Unexpected startgist: a previous gist was not closed");
                }
                currentGist = {
                    "id": line.split(":")[1].trim(),
                    "filename": line.split(":")[2].trim(),
                    "lines": []
                };
            } else if (line.indexOf("// endgist") === 0) {
                if (!currentGist) {
                    throw new PluginError(PLUGIN_NAME, filename + ":" + lineNo + " Unexpected endgist: missing startgist earlier");
                }
                gists.push(currentGist);
                currentGist = null;
            } else if (currentGist && line.indexOf("gisthide") < 0) {
                currentGist.lines.push(line);
            }
            lineNo += 1;
        });
        if (currentGist) {
            throw new PluginError(PLUGIN_NAME, "Reached end of file but gist is still open");
        }
        fs.readFile(getUserHome() + '/.gistauth', 'utf8', function (err, auth) {
            gists.forEach(function (gist) {
                var json = {
                    files: {}
                };
                json.files[gist.filename] = {
                    'content': leftAlign(gist.lines).join("\n")
                };
                var data = JSON.stringify(json);
                gutil.log("Push gist " + gist.id)
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
                });
                req.write(data);
                req.end();
            });
        });
    });
};

// exporting the plugin main function
module.exports = gulpGist;
