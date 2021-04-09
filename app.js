//import libraries
var express = require("express");
var passport = require("passport");
var localStrat = require("passport-local");
var passportLocal = require("passport-local-mongoose");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var User = require("./models/user");
var app = express();
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");
var flash  = require("connect-flash");
var PORT   = process.env.PORT || 3000;


//intial setup for app

app.use(require("express-session")({
	secret:"this is a secret",
	resave:true,
	saveUninitialized:true,
	
}));


app.use(flash());

mongoose.set('useUnifiedTopology', true);
mongoose.connect("mongodb+srv://TG0209:Tushar123@cluster0.z8nda.mongodb.net/userdata?retryWrites=true&w=majority", {useNewUrlParser: true});
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + "/public"));
app.set("view engine","ejs");

app.use(passport.initialize());
app.use(passport.session());


passport.use(new localStrat(User.authenticate()));

passport.serializeUser(function (user, cb) {
    cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
    cb(null, obj);
});

app.use(function(req,res,next){
	res.locals.error = req.flash("error");
   	res.locals.success = req.flash("success");
	next();
});


// Routes

//index route redirect to home page
app.get("/",function(req,res){
	res.redirect("/home");
});

//home rate
app.get("/home",function(req,res){
	res.render("home");	
	
});

//main page after login
app.get("/secret",isLoggedIn,function(req,res){
	res.render("secret");
});


// signup form
app.get("/register",function(req,res){
	res.render("register");
});

// add user to the database
app.post("/register",function(req,res){
	var newUser = new User({
        username: req.body.username,
        email: req.body.email,
      });

	User.register(newUser, req.body.password ,function(err,user){
		if(err){
			console.log(err);
			return res.render("register");
		}
		passport.authenticate("local")(req , res, function(){
			req.flash('success', 'Success! you have been registered.');
			res.redirect("/secret");	
		});
	});
});

// login form
app.get("/login",function(req,res){
	res.render("login");
});

// login logic
app.post("/login",passport.authenticate("local",{
	successRedirect : "/secret",
	failureRedirect : "/login"
}),function(req,res){
});

// logout
app.get("/logout",function(req,res){
	req.logout();
	 req.flash('success', 'you have successfuly loged out');
	res.redirect("/home");
});

// forgot password form
app.get('/forgot', function(req, res) {
  res.render('forgot');
});

//forgot password logic
app.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour - token valid limit send to reset the password

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'tushargautam588@gmail.com',
          pass: 'tushar@123'
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'tushargautam588o@gmail.com',
        subject: 'Password Reset',
        text: 'You are receiving this because you have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        console.log('mail sent');
		console.log(user.email)
        req.flash('error', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

//form to set new password
app.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {token: req.params.token});
  });
});

//new password setup logic
app.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'tushargautam588o@gmail.com',
          pass: 'tushar@123'
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'tushargautam588o@gmail.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/secret');
  });
});


// middleware - to chech if a user is autheticated
function isLoggedIn(req,res,next){
	if(req.isAuthenticated()){
		return next();
	}
	res.redirect("/login");

}

//listen route
app.listen(PORT,function(){
	console.log("sever started!!");
});
