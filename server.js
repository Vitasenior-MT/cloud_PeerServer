// server.js

// BASE SETUP
// =============================================================================
// Get the env variables from .env
if (process.env.NODE_ENV === "development") {
  require('dotenv').config();
}

require('./src/models/index').sequelize.sync().then(
  () => {
    console.log('\x1b[32m(PLAIN) Connection established with External Services\x1b[0m.');

    var app = require('express')();
    var server = require('http').createServer(app);

    let options = {
      timeout: 5000,
      key: "8dnMsRvmGdz3fPG8RYO8muaUfQ2Iy1lE",
      ip_limit: 5000,
      concurrent_limit: 5000,
      proxied: false,
      path: "/",
      port: process.env.PORT || 8808,
      allow_discovery: false,
      debug: true
    };

    var peerserver = require('./src').ExpressPeerServer(server, options);

    // Handle peer registration
    app.use('/', peerserver);

    // Start ws server
    server.listen(options.port, () => {
      console.log('\x1b[32m%s %d\x1b[0m.', '(PLAIN) Server listening on port', options.port);
    });

    peerserver.on('connection', function (id) {
      console.log("\x1b[36mnew connection: %s\x1b[0m", id);
    });
  }, error => { console.log('Unable to connect to External Services.', error); process.exit(1); });

