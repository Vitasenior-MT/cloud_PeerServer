var db = require('./models/index'),
  fs = require("fs"),
  jwt = require('jsonwebtoken');

exports.validateToken = (token) => {
  return new Promise((resolve, reject) => {

    let options = {
      algorithms: ["RS256"]
    };

    jwt.verify(token, process.env.PUBLIC_KEY, options, (error, payload) => {
      if (error) reject("Invalid token provided");
      else resolve();
    });
  });
}