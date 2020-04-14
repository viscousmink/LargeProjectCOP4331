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

/**
 * @swagger
 * /api/emailverification:
 *   post:
 *     tags:
 *       - Email Verification
 *     description: Creates a user and sends an email to verify the user is human.
 *     parameters:
 *       - name: vericode
 *         description: User's verification code
 *         in: body
 *         required: true
 *         type: integer
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: error values
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

/**
 * @swagger
 * /api/register:
 *   post:
 *     tags:
 *       - Register
 *     description: Creates a user and sends an email to verify the user is human.
 *     parameters:
 *       - name: user
 *         description: User's username
 *         in: body
 *         required: true
 *         type: string
 *       - name: password
 *         description: User's password
 *         in: body
 *         required: true
 *         type: string
 *       - name: email
 *         description: User's email
 *         in: body
 *         required: true
 *         type: string
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: error values
 */
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

/**
 * @swagger
 * /api/allrecipes:
 *   get:
 *     tags:
 *       - Gets all recipes
 *     description: Gets an array of all recipes in the db.
 *     parameters:
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: error values
 */
router.get('/allrecipes', async(req, res, next) => {
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

/**
 * @swagger
 * /api/createrecipe:
 *   post:
 *     tags:
 *       - CreateRecipe
 *     description: Creates a recipe and stores it in the db
 *     parameters:
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: error values
 */
router.post('/createrecipe', async(req, res, next) => {
	const title = sanitize(req.body.title);
	const description = sanitize(req.body.description);
	const servings = sanitize(req.body.servings);
	const time = sanitize(req.body.time);
	const store = sanitize(req.body.store);
	const numIngredients = sanitize(req.body.numIngredients);
	const numSteps = sanitize(req.body.numSteps);
	const user = sanitize(req.body.user);
	const date = sanitize(req.body.date);
	const ingredients = sanitize(req.body.ingredients);
	const steps = sanitize(req.body.steps);

	const newPublicRecipe = {
		_id: new mongoose.Types.ObjectId(),
		creator: user,
		name: name,
		date: date,
		ingredients: ingredients,
		steps: steps
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

/**
 * @swagger
 * /api/login:
 *   post:
 *     tags:
 *       - Login
 *     description: Creates a user and sends an email to verify the user is human.
 *     parameters:
 *       - name: user
 *         description: User's username
 *         in: body
 *         required: true
 *         type: string
 *       - name: password
 *         description: User's password
 *         in: body
 *         required: true
 *         type: string
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: error values
 */
router.post('/login', async (req, res) => {

	const user = sanitize(req.body.user);
	const password = sanitize(req.body.password);

	const db = client.db();

	const result = await db.collection('Users').findOne({user: user});
	var err = '';

	if(result != null) {
		if(bcrypt.compareSync(password, result.password) == true) {
			const secretKey = process.env.accessTokenSecret;
			jwt.sign({user: user}, secretKey, (err, token) => {
				//Res.json({}) we send the token that the user will save on the front end to access protected routes:
				res.json({
					token: token
				});
			});
			console.log(user);
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
