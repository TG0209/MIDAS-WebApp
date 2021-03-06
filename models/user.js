//user model
var mongoose = require("mongoose");
var passportLocal = require("passport-local-mongoose");

var userSchema = new mongoose.Schema({
	username : String,
	password : String,
	email: {type: String, unique: true, required: true},
    resetPasswordToken: String,
    resetPasswordExpires: Date
});

userSchema.plugin(passportLocal);
module.exports = mongoose.model("User",userSchema);