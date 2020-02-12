const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const bcrypt = require('bcryptjs');
const sanitize = require('mongo-sanitize');
const database = require('../database.js');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(database.URL, {
	useUnifiedTopology: true,
	connectTimeoutMS: 1000
});
require('dotenv').config();

//connecting to the server
client.connect(function(err, db) {
	if (err) {
		console.log(
			'Unable to connect to the server. Please start the server. Error:',
			err
		);
	} else {
		console.log('Connected to Server successfully!');
	}
});

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));

/* Possible Requests
	-- Email Verification
		Takes json of verification code {"vericode": <vericode>}
		updates corresponding vericode in db to {"verified": true}
	-- Register:
		Take a JSON of new user info, {"user": "<user>", "email": "<email>", "password": "<password>"}
		Sends email to the new user's email in order to verify account creation
		Stores in db {"user": "<user>", "email": "<email>", "password": "<password>", "verified": false, "vericode":<vericode>}
	-- Login
		takes {"user": "<user>", "password": "<password>"}
		responds with {"error": <err>}
*/

router.post('/emailverification', async(req, res, next) => {

	var err = '';

	const db = client.db();

	const code = sanitize(req.body.vericode);

	const user = await db.collection('Users').findOne({"vericode": code});

	const update = {
		$set: {
			user: user.user,
			password: user.password,
			email: user.email,
			vericode: 0,
			verified: true
		}
	};

	const result = await db.collection('Users').updateOne(user, update, { upsert: true });

	var ret = { error: err };
	res.status(200).json(ret);
});

router.post('/register', async(req, res, next) => {
	const user = sanitize(req.body.user);
	const password = sanitize(req.body.password);
	const email = sanitize(req.body.email);
	
	const db = client.db();

	const userNameCheck = await db.collection('Users').findOne({"user": user});
	if(userNameCheck) {
		var err = 'user_name_taken';
		var ret = { error: err };
		res.status(200).json(ret);
	} else {
		var salt = bcrypt.genSaltSync(10);
		var hash = bcrypt.hashSync(password, salt);

		var code = Math.floor(100000 + Math.random() * 900000);

		var flag = true;
		while(flag) {
			var randomCheck = await db.collection('Users').findOne({"vericode": code});
			if(randomCheck) {
				code = Math.floor(100000 + Math.random() * 900000);
			} else {
				flag = false;
			}
		}

		const newUser = {
			_id: new mongoose.Types.ObjectId(),
			user: user,
			password: hash,
			email: email,
			verified: false,
			vericode: code
		};

		var err = '';

		var transporter = nodemailer.createTransport({
			service: 'gmail',
				auth: {
					user: 'COP4331largeproject@gmail.com',
					pass: process.env.DBPASSWORD
				}
		});

		var mailOptions = {
			from: 'COP4331largeproject@gmail.com',
			to: `${email}`,
			subject: 'Email Verification',
			text: `Please go to ... and enter ${code} to verify your account!`
		};

		transporter.sendMail(mailOptions, function(error, info){
			if (error) {
				console.log(error);
			} else {
				console.log('Email sent: ' + info.response);
			}
			if(error) {
				err = error;
			}
		});

		try {
			const result = await db.collection('Users').insertOne(newUser);
		} catch (e) {
			err = e.toString();
		}
		var ret = { error: err };
		res.status(200).json(ret);
	}
});

module.exports = router;