const { Schema, model } = require("mongoose");

contactsSchema = new Schema({
  username: String,
  contacts: [
    {
      username: String,
      lastMessageUsername: String,
      lastMessage: String,
      lastMessageAt: String,
      lastMessageSeen: Boolean,
    },
  ],
});

module.exports = model("Contacts", contactsSchema);
