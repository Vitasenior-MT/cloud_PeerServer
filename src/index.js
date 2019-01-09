var express = require('express');
var proto = require('./server');
var cors = require("cors");
var bodyParser = require("body-parser");

exports.ExpressPeerServer = (server, options) => {
  var app = express();

  _extend(app, proto);
  app.use(cors());
  app.use(bodyParser.json());

  // Connection options
  app._options = options;

  // Connected clients
  app._clients = {};

  // Messages waiting for another peer.
  app._outstanding = {};

  // Mark concurrent users per ip
  app._ips = {};

  app.post("/:key/:id/:token/id", (req, res) => res.sendStatus(200));

  app.on('mount', function () {
    if (!server) {
      throw new Error('Server is not passed to constructor - ' +
        'can\'t start PeerServer');
    }

    // Initialize HTTP routes. This is only used for the first few milliseconds
    // before a socket is opened for a Peer.
    app._setCleanupIntervals();
    app._initializeWSS(server);
  });

  return app;
}

_extend = (dest, source) => {
  source = source || {};
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      dest[key] = source[key];
    }
  }
  return dest;
}