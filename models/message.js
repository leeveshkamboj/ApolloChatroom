const { Schema, model } = require("mongoose");

messageSchema = new Schema({
  username: String,
  body: String,
  createdAt: String,
});
module.exports = model("Message", messageSchema);
