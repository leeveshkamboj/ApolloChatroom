const nodemailer = require('nodemailer');

const Config = require('../config')

const transport = nodemailer.createTransport({
    host: Config.smpt_host,
    port: Config.smpt_port,
    auth: {
        user: Config.smpt_user,
        pass: Config.smpt_pass
    }
});

module.exports = transport