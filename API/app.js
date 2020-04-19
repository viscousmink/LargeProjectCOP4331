const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const bcrypt = require('bcryptjs');
const sanitize = require('mongo-sanitize');
const database = require('../database.js');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const MongoClient = require('mongodb').MongoClient;
const jwt = require('jsonwebtoken');

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

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

		const secretKey = process.env.accessTokenSecret;

        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }

            //req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

router.post('/testingAuth', authenticateJWT, async(req, res, next) => {
	res.status(200).json({"gotHere": "here"});
});


router.post('/emailverification', async(req, res, next) => {

	var err = '';

	const db = client.db();

	const code = sanitize(req.body.vericode);

	const user = await db.collection('Users').findOne({"vericode": code});

	const update = {
		$set: {
			username: user.username,
			password: user.password,
			email: username.email,
			vericode: 0,
			verified: true
		}
	};

	const result = await db.collection('Users').updateOne(user, update, { upsert: true });

	var ret = { error: err };
	res.status(200).json(ret);
});


router.post('/register', async(req, res, next) => {
	const username = sanitize(req.body.username);
	const password = sanitize(req.body.password);
	const email = sanitize(req.body.email);

	const db = client.db();

	const userNameCheck = await db.collection('Users').findOne({"username": username});
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
			username: username,
			password: hash,
			email: email,
			verified: false,
			vericode: code,
			following: []
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


router.get('/allrecipes', authenticateJWT, async(req, res, next) => {
	const db = client.db();

	var err = '';

	const results = await db.collection('PublicRecipes').find({}).toArray();
	var _ret = [];
	for(var i = 0; i < results.length; i++) {
		_ret.push(results[i]);
	}
	var ret = {results: _ret, error: err};

	res.status(200).json(ret);
});


router.get('/userrecipes', authenticateJWT, async(req, res, next) => {
	console.log(req.query['username']);

	const username = req.query['username'];

	const db = client.db();

	var err = '';

	const results = await db.collection('PublicRecipes').find({creator: username}).toArray();
	console.log(results);
	var _ret = [];
	for(var i = 0; i<results.length; i++) {
		_ret.push(results[i]);
	}
	var ret = {results: _ret, error: err};

	res.status(200).json(ret);
});


router.post('/createrecipe', authenticateJWT, async(req, res, next) => {
	const title = sanitize(req.body.title);
	const description = sanitize(req.body.description);
	const servings = sanitize(req.body.servings);
	const time = sanitize(req.body.time);
	const store = sanitize(req.body.store);
	const creator = sanitize(req.body.creator);
	const ingredients = sanitize(req.body.ingredients);
	const steps = sanitize(req.body.steps);
	//const likes = sanitize(req.body.likes);

	const newPublicRecipe = {
		_id: new mongoose.Types.ObjectId(),
		title: title,
		description: description,
		servings: servings,
		time: time,
		store: store,
		creator: creator,
		ingredients: ingredients,
		steps: steps,
		//likes: likes
	};
	const db = client.db();
	var err = '';
	try {
		const result = await db.collection('PublicRecipes').insertOne(newPublicRecipe);
	} catch(e) {
		err = e.toString();
	}
	var ret = {error: err};
	res.status(200).json(ret);
});

router.post('/deleterecipe', authenticateJWT, async(req, res, next) => {
	const title = sanitize(req.body.title);
	const creator = sanitize(req.body.creator);

	const db = client.db();

	var err = '';
	try{
		const result = await db.collection('PublicRecipes').removeOne({"title": title, "creator": creator});
	} catch(e) {
		err = e.toString();
	}
	res.status(200).json({"error": err});
});

router.get('/searchrecipe', authenticateJWT, async(req, res, next) => {
	const title = req.query['title'];
	const db = client.db();

	const results = await db.collection('PublicRecipes').find().toArray();

	var err = '';

	var _ret = [];
	for(var i = 0; i<results.length; i++) {
		if(results[i].title.toLowerCase().includes(title.toLowerCase())){
			_ret.push(results[i]);
		}
	}
	var ret = {results: _ret, error: err};

	res.status(200).json(ret);
});

router.post('/modifyrecipe', authenticateJWT, async(req, res, next) => {
	const _id = sanitize(req.body._id);
	const title = sanitize(req.body.title);
	const description = sanitize(req.body.description);
	const servings = sanitize(req.body.servings);
	const time = sanitize(req.body.time);
	const store = sanitize(req.body.store);
	const creator = sanitize(req.body.creator);
	const ingredients = sanitize(req.body.ingredients);
	const steps = sanitize(req.body.steps);
	//const likes = sanitize(req.body.likes);

	const db = client.db();

	const recipe = db.collection('PublicRecipes').findOne({_id: _id});

	const update = {
		$set: {
			title: title,
			description: description,
			servings: servings,
			time: time,
			store: store,
			creator: creator,
			ingredients: ingredients,
			steps: steps,
			//likes: likes
		}
	};

	const result = await db.collection('PublicRecipes').updateOne(recipe, update, { upsert: true });

	res.status(200).json({error: ""});
});


router.post('/login', async (req, res) => {

	const username = sanitize(req.body.username);
	const password = sanitize(req.body.password);

	const db = client.db();

	const result = await db.collection('Users').findOne({username: username});
	var err = '';

	if(result != null && result.verified == true) {
		if(bcrypt.compareSync(password, result.password) == true) {
			const secretKey = process.env.accessTokenSecret;
			jwt.sign({username: username}, secretKey, (err, token) => {
				//Res.json({}) we send the token that the user will save on the front end to access protected routes:
				res.json({
					token: token
				});
			});
			console.log(username);
		} else {
			err = 'not_correct_password';
			res.json({error: err});
		}
	} else {
		err = 'not_correct_user';
		res.json({error: err});
	}
});

module.exports = router;
