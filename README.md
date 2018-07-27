# Build

`npm install`

`npm run build`

edit server\targets.json

edit server\bookmarks.json

# Run

`node server\index.js`

open [http://localhost:4000](http://localhost:4000)

# Hack (you need two shells)

`rd /s /q build`

first shell (frontend)

`npm run start`

second shell (backend)

`set DEBUG=server`

`nodemon server\index.js`

open [http://localhost:3000](http://localhost:3000)