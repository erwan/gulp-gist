gulp-gist
=========

Parse source code for comments and update related gists. Useful to test code snippets published on Gist.

You need to create a ~/.gistauth file with authentication info, e.g. "username:password".

### Usage

Annotate your code to delimit Gists (they must already exist on github).

```javascript

var toto

// startgist:12345-id-of-your-gist-123456:filename.js

// This will go to the gist
var sum = 2 + 2;

// endgist

// No longer in the gist
```

You can then use it in your gulpfile:

```javascript

var gist = require('gulp-gist');

gulp.task('deploy:gist', ['test:doc'], function () {
    gulp.src("./test/doc.js")
        .pipe(gist());
});


```
