## Demo

![demo](http://mugiseyebrows.github.io/img/cpp-compile-on-save.gif)

## Build

```bash
git clone git@github.com:mugiseyebrows/cpp-compile-on-save.git
cd cpp-compile-on-save
npm install
npm run build
```

## Configure

1) Open config tab.
2) Edit envs. Env is a group of targets with unique `name`. You can optionaly define PATH env variable for env. Targets can be in more than one env.
3) Edit targets. Target must have unique `name` and associated directory `cwd` in which "make" will be executed. If you specify `debug` and `release` binaries, they modification time will be displayed. If you specify `kill` then pkill/taskkill will be executed if compilation fails with "cannot open output" type of errors.
4) Edit commands. Commands must have unique `name`, and nonempty `cmd` to execute. Command can have "target" or "target-popup" `context`, then they will be in targets menu; "bookmark" `context`, then they will be in bookmarks menu; or "hidden" context for special "explore" and "edit-file" commands which executed when target name in targets tab is clicked or stdout or stderr link is clicked. If command is `task` it is executed in task queue and stdout and stderr is captured, otherwise it is executed immediately as detached process.
5) Select serial port if you are going to use [serial-traffic-lights](https://github.com/mugiseyebrows/serial-traffic-lights) or leave it as "none".
6) Press save and hide config tab.
7) Now your code is always in sync with your binaries every time you press save in your favourite editor.

## Run

```bash
node server/index.js
```

open [http://localhost:4000](http://localhost:4000)

## Hack 

```bash
node dev.js
```
