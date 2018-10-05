## Demo

![demo](http://mugiseyebrows.github.io/img/cpp-compile-on-save.gif)

## Build

`git clone git@github.com:mugiseyebrows/cpp-compile-on-save.git`

`cd cpp-compile-on-save`

`npm install`

`npm run build`

1) Edit `server\targets.json`: specify all projects that you working on using following format:

```json
    [{
        "name": "name",
        "debug": "debug binary path",
        "release": "release binary path",
        "cwd": "cwd for make",
        "kill": "processes that you want to kill when 'cannot open output' error occur"
    }]
```

2) Copy `server\bookmarks.json.example` to `server\bookmarks.json`. Specify there all application you use frequently.
3) Copy `server\config.json.example` to `server\config.json`. Specify there your code `editor` and `make` command, optionaly specify `bash` and `gitk` path, also specify `serialPort` if you are going to use [serial-traffic-lights](https://github.com/mugiseyebrows/serial-traffic-lights) or remove `serialPort` from config if you are not. 

## Run

`node server\index.js`

open [http://localhost:4000](http://localhost:4000)

## Hack 

first shell (frontend)

`rd /s /q build`

`npm run start`

second shell (backend)

`set DEBUG=server`

`nodemon --watch server server\index.js`

open [http://localhost:3000](http://localhost:3000)