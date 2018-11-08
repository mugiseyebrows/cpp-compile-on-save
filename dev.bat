

set PATH=C:\Qt5\Tools\mingw530_32\bin;C:\Qt5\5.11.1\mingw53_32\bin;C:\Qt5\Tools\QtCreator\bin;%PATH%
start yarn run start
set DEBUG=cpp-compile-on-save
nodemon -w server server\index.js
