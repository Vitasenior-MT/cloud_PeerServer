var db = require('./models/index'),
  fs = require("fs"),
  jwt = require('jsonwebtoken');

exports.validateToken = (token) => {
  return new Promise((resolve, reject) => {

    let public_key = fs.readFileSync(__dirname + '/keys/cert.pem').toString();
    if (public_key === undefined) reject("Server cannot validate the token");

    let options = {
      algorithms: ["RS256"]
    };

    jwt.verify(token, public_key, options, (error, payload) => {
      if (error) reject("Invalid token provided");
      else resolve();

      // // verify if user
      // if (payload.role === "User") db.User.findById(payload.id).then(
      //   user => {
      //     // if is a user, set its own exchange
      //     if (user) user.getVitaboxes({ where: { active: true } }).then(
      //       vitaboxes => {
      //         // push exchanges to vitaboxes
      //         let rooms = vitaboxes.map(x => x.id);
      //         if (user.doctor) user.getPatients().then(
      //           patients => {
      //             patients.forEach(x => rooms.push(x.id));
      //             resolve({ rooms: rooms, entity: user.id });
      //           }, error => reject(error));
      //         else resolve({ rooms: rooms, entity: user.id });
      //       }, error => reject(error));
      //     else reject(new Error("user not found"));
      //   }, error => reject(error));
      // // if is a vitabox, just return their own exchange
      // else resolve({ rooms: [payload.id], entity: payload.id });


    });
  });
}