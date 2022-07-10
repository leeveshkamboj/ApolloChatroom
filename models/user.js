const { Schema, model } = require("mongoose");

userSchema = new Schema({
  username: String,
  email: String,
  password: String,
  createdAt: String,
  verified: {
    type: Boolean,
    default: true,
  },
});
module.exports = model("User", userSchema);
