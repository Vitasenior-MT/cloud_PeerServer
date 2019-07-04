var db = require('./models/index'),
  fs = require("fs"),
  jwt = require('jsonwebtoken');

exports.validateToken = (token) => {
  return new Promise((resolve, reject) => {

    let options = {
      algorithms: ["RS256"]
    };

    let puKey="-----BEGIN PUBLIC KEY-----\n"+process.env.PUBLIC_KEY+"\n-----END PUBLIC KEY-----";

    jwt.verify(token, puKey, options, (error, payload) => {
      if (error) reject("Invalid token provided");
      if (payload.role === "User") db.User.findOne({
        where: { id: payload.id },
        include: [{ model: db.Vitabox, attributes: ['id'] }, { model: db.Patient, attributes: ['id', 'vitabox_id'] }]
      }).then(
        user => {
          if (user) resolve([].concat.apply(user.Vitaboxes.map(x => x.id), user.Patients.map(patient => patient.vitabox_id)));
          else reject(new Error("user not found"));
        }, error => reject(error));
      else db.Vitabox.findOne({
        where: { id: payload.id },
        include: [{ model: db.User, attributes: ['id'] }, { model: db.Patient, attributes: ['id'], include: [{ model: db.User, as: 'Doctors', attributes: ['id'] }] }]
      }).then(
        vitabox => {
          if (vitabox) resolve([].concat.apply(vitabox.Users.map(x => x.id), vitabox.Patients.map(patient => { return patient.Doctors.map(x => x.id) })));
          else reject(new Error("vitabox not found"));
        }, error => reject(error));
    });
  });
}