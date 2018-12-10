
var app = require('express')();
var server = require('http').createServer(app);
var peerserver = require('peer').ExpressPeerServer(server, { key: "8dnMsRvmGdz3fPG8RYO8muaUfQ2Iy1lE", path: "/" });

// Handle peer registration
app.use('/', peerserver);

// Start ws server
let port = process.env.PORT || 8808;
server.listen(port, () => {
  console.log('\x1b[32m%s %d\x1b[0m.', '(PLAIN) Server listening on port', port);
});

peerserver.on('connection', function (id) {
  console.log("connection: ", id);
});
