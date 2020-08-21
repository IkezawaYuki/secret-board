'use strict';

const http = require('http');
const auth = require('http-auth');
const basic = auth.basic({
  realm: "Enter username and password.",
  file: './users.htpasswd'
});
const router = require('./lib/router');
const server = http.createServer(basic, (req, res) => {
  router.route(req, res);
})
.on('error', e => {
  console.log("Server Error", e);
})
.on('clientError', e => {
  console.log("Client Error", e);
});

const port = process.env.PORT || 8000;
server.listen(port, () => {
  console.info('Listening on ' + port);
})