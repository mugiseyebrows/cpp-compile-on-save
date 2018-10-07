

set PATH=C:\Qt5\Tools\mingw530_32\bin;C:\Qt5\Tools\mingw530_32\bin;C:\Qt5\Tools\QtCreator\bin;%PATH%
start yarn run start
set DEBUG=server
nodemon -w server server\index.js
