const { Schema, model } = require("mongoose");

pmSchema = new Schema({
  users: [String],
  messages: [
    {
      username: String,
      body: String,
      createdAt: String,
      seen: Boolean,
    },
  ],
});
module.exports = model("Pm", pmSchema);
