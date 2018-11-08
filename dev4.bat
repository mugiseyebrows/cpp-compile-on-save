

set PATH=C:\mingw\bin;C:\qt\qtcreator-2.5.2\bin;C:\qt\4.8.3\bin;C:\lib;%PATH%
cd %~dp0
D:
start yarn run start
set DEBUG=cpp-compile-on-save
nodemon -w server server\index.js
