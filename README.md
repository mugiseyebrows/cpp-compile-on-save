## Demo

![demo](http://mugiseyebrows.github.io/img/cpp-compile-on-save.gif)

## Build

`npm install`

`npm run build`

1) edit `server\targets.json`: specify all projects that you working on using following format

```json
    [{
        "name": "name",
        "debug": "debug binary path",
        "release": "release binary path",
        "cwd": "cwd for make",
        "kill": "binaries that you want to kill when 'cannot open output' error happen"
    }]
```

2) edit `server\bookmarks.json`: specify all application you use frequently

3) edit `server\config.json`: specify `serialPort` if you are going to use [serial-traffic-lights](https://github.com/mugiseyebrows/serial-traffic-lights) or remove if you are not

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