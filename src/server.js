var WebSocketServer = require("ws").Server,
  url = require("url"),
  utils = require("./utils");

var app = (exports = module.exports = {});

/** Initialize WebSocket server. */
app._initializeWSS = function (server) {
  var self = this;

  // Create WebSocket server as well.
  this._wss = new WebSocketServer({ path: "/peerjs", server: server });

  this._wss.on("connection", function (socket, req) {
    var query = url.parse(req.url, true).query;
    var id = query.id;
    var token = query.token;
    var key = query.key;
    var ip = req.socket.remoteAddress;

    if (!id || !token || !key) {
      socket.send(
        JSON.stringify({
          type: "ERROR",
          payload: { msg: "No id, token, or key supplied to websocket server" }
        })
      );
      socket.close();
      return;
    }
    //________________________________________________________________________
    utils.validateToken(token).then(
      peers => {
        if (!self._clients[key] || !self._clients[key][id]) {
          self._checkKey(key, ip, function (err) {
            if (!err) {
              if (!self._clients[key][id]) {
                self._clients[key][id] = { token: token, ip: ip };
                self._ips[ip]++;
                socket.send(JSON.stringify({ type: "OPEN" }));
              }
              self._configureWS(socket, key, id, token, peers);
            } else {
              socket.send(JSON.stringify({ type: "ERROR", payload: { msg: err } }));
            }
          });
        } else {
          self._configureWS(socket, key, id, token, peers);
        }
      }).catch(err => {
        console.log(err);
        self._log("INVALID TOKEN", err.msg);
        socket.send(JSON.stringify({ type: "ERROR", payload: { msg: err.msg } }));
      });
    //________________________________________________________________________
  });
  this._wss.on("error", (err) => {
    self._log("WS ERROR", err.message);
  })
};

app._configureWS = function (socket, key, id, token, peers) {
  var self = this;
  var client = this._clients[key][id];

  if (token === client.token) {
    // res 'close' event will delete client.res for us
    client.socket = socket;
    client.peers = peers;
    self._log("Allowed peers", peers);
    // Client already exists
    if (client.res) {
      client.res.end();
    }
  } else {
    // ID-taken, invalid token
    socket.send(
      JSON.stringify({ type: "ID-TAKEN", payload: { msg: "ID is taken" } })
    );
    socket.close();
    return;
  }

  this._processOutstanding(key, id);

  // Cleanup after a socket closes.
  socket.on("close", function () {
    self._log("Socket closed:", id);
    if (client.socket == socket) {
      self._removePeer(key, id);
    }
  });

  // Handle messages from peers.
  socket.on("message", function (data) {
    try {
      var message = JSON.parse(data);
      //________________________________________________________________________
      if (["OFFER", "ANSWER"].indexOf(message.type) !== -1) {
        if (peers.includes(message.dst)) {
          self._handleTransmission(key, {
            type: message.type,
            src: id,
            dst: message.dst,
            payload: message.payload
          });
        } else {
          self._handleTransmission(key, {
            type: "EXPIRE",
            src: id,
            dst: message.dst
          });
        }
        //________________________________________________________________________
      } else if (["CANDIDATE", "LEAVE"].indexOf(message.type) !== -1) {
        self._handleTransmission(key, {
          type: message.type,
          src: id,
          dst: message.dst,
          payload: message.payload
        });
      } else if (message.type === 'HEARTBEAT') {
      } else {
        self._log("Message unrecognized");
      }
    } catch (e) {
      self._log("Invalid message", data);
      throw e;
    }
  });

  // We're going to emit here, because for XHR we don't *know* when someone
  // disconnects.
  this.emit("connection", id);
};

app._checkKey = function (key, ip, cb) {
  if (key == this._options.key) {
    if (!this._clients[key]) {
      this._clients[key] = {};
    }
    if (!this._outstanding[key]) {
      this._outstanding[key] = {};
    }
    if (!this._ips[ip]) {
      this._ips[ip] = 0;
    }
    // Check concurrent limit
    if (
      Object.keys(this._clients[key]).length >= this._options.concurrent_limit
    ) {
      cb("Server has reached its concurrent user limit");
      return;
    }
    if (this._ips[ip] >= this._options.ip_limit) {
      cb(ip + " has reached its concurrent user limit");
      return;
    }
    cb(null);
  } else {
    cb("Invalid key provided");
  }
};

app._pruneOutstanding = function () {
  var keys = Object.keys(this._outstanding);
  for (var k = 0, kk = keys.length; k < kk; k += 1) {
    var key = keys[k];
    var dsts = Object.keys(this._outstanding[key]);
    for (var i = 0, ii = dsts.length; i < ii; i += 1) {
      var offers = this._outstanding[key][dsts[i]];
      var seen = {};
      for (var j = 0, jj = offers.length; j < jj; j += 1) {
        var message = offers[j];
        if (!seen[message.src]) {
          this._handleTransmission(key, {
            type: "EXPIRE",
            src: message.dst,
            dst: message.src
          });
          seen[message.src] = true;
        }
      }
    }
    this._outstanding[key] = {};
  }
};

/** Cleanup */
app._setCleanupIntervals = function () {
  var self = this;

  // Clean up ips every 10 minutes
  setInterval(function () {
    var keys = Object.keys(self._ips);
    for (var i = 0, ii = keys.length; i < ii; i += 1) {
      var key = keys[i];
      if (self._ips[key] === 0) {
        delete self._ips[key];
      }
    }
  }, 600000);

  // Clean up outstanding messages every 5 seconds
  setInterval(function () {
    self._pruneOutstanding();
  }, 5000);
};

/** Process outstanding peer offers. */
app._processOutstanding = function (key, id) {
  var offers = this._outstanding[key][id];
  if (!offers) {
    return;
  }
  for (var j = 0, jj = offers.length; j < jj; j += 1) {
    this._handleTransmission(key, offers[j]);
  }
  delete this._outstanding[key][id];
};

app._removePeer = function (key, id) {
  if (this._clients[key] && this._clients[key][id]) {
    this._ips[this._clients[key][id].ip]--;
    delete this._clients[key][id];
    this.emit("disconnect", id);
  }
};

/** Handles passing on a message. */
app._handleTransmission = function (key, message) {
  var type = message.type;
  var src = message.src;
  var dst = message.dst;
  var data = JSON.stringify(message);

  var destination = this._clients[key][dst];

  // User is connected!
  if (destination) {
    try {
      this._log(type, "from", src, "to", dst);
      if (destination.socket) {
        destination.socket.send(data);
      } else if (destination.res) {
        data += "\n";
        destination.res.write(data);
      } else {
        // Neither socket no res available. Peer dead?
        throw "Peer dead";
      }
    } catch (e) {
      // This happens when a peer disconnects without closing connections and
      // the associated WebSocket has not closed.
      // Tell other side to stop trying.
      this._removePeer(key, dst);
      this._handleTransmission(key, {
        type: "LEAVE",
        src: dst,
        dst: src
      });
    }
  } else {
    // Wait for this client to connect/reconnect (XHR) for important
    // messages.
    if (type !== "LEAVE" && type !== "EXPIRE" && dst) {
      var self = this;
      if (!this._outstanding[key][dst]) {
        this._outstanding[key][dst] = [];
      }
      this._outstanding[key][dst].push(message);
    } else if (type === "LEAVE" && !dst) {
      this._removePeer(key, src);
    } else {
      // Unavailable destination specified with message LEAVE or EXPIRE
      // Ignore
    }
  }
};

app._log = function () {
  if (this._options.debug) {
    console.log.apply(console, arguments);
  }
};