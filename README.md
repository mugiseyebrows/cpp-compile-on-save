## Demo

![demo](http://mugiseyebrows.github.io/img/cpp-compile-on-save.gif)

## Build

`git clone git@github.com:mugiseyebrows/cpp-compile-on-save.git`

`cd cpp-compile-on-save`

`npm install`

`npm run build`

1) Edit `server\targets.json`: specify all projects that you working on using following format (everything except name and cwd is optional):

```json
    [{
        "name": "name",
        "debug": "debug binary path",
        "release": "release binary path",
        "cwd": "cwd for make",
        "kill": "processes that you want to kill when 'cannot open output' error occur"
    }]
```

2) Edit `config.json`: specify target commands, bookmarks.

## Run

`node server/index.js`

open [http://localhost:4000](http://localhost:4000)

## Hack 

first shell (frontend)

`rm -rf build`

`npm run start`

second shell (backend)

`export DEBUG=server`

`nodemon --watch server server/index.js`

open [http://localhost:3000](http://localhost:3000)