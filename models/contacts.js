const { Schema, model } = require("mongoose");

contactsSchema = new Schema({
  username: String,
  contacts: [
    {
      username: String,
      lastMessageUsername: String,
      lastMessage: String,
      lastMessageAt: String,
    },
  ],
});

module.exports = model("Contacts", contactsSchema);
