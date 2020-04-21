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
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;

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
 *         description: Users verification code
 *         in: query
 *         required: true
 *         type: integer
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: error values
 */
router.get('/emailverification', async(req, res, next) => {

	var err = '';

	const db = client.db();

	const code = Number(req.query['veri']);

	//const user = await db.collection('Users').findOne({"vericode": code});

	//const update = {
	//	$set: {
	//		username: user.username,
	//		password: user.password,
	//		email: username.email,
	//		vericode: 0,
	//		verified: true
	//	}
	//};

	const result = await db.collection('Users').updateMany({vericode: code}, {$set: {vericode: 0, verified: true}}, { upsert: false });

	var ret = { error: err };
	res.sendFile('/index.html', { root: __dirname}); // sends a congrats html
});


/**
 * @swagger
 * /api/resetpassword:
 *   post:
 *     tags:
 *       - Reset Password
 *     description: Creates a user and sends an email to verify the user is human.
 *     parameters:
 *       - name: user
 *         description: User's username
 *         in: body
 *         required: true
 *         type: string
 *       - name: password
 *         description: User's new password
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
router.post('/resetpassword', async(req, res, next) => {
	const db = client.db();

	const username = sanitize(req.body.username);
	const email = sanitize(req.body.email);
	const password = sanitize(req.body.password);

	var salt = bcrypt.genSaltSync(10);
	var hash = bcrypt.hashSync(password, salt);

	const result = await db.collection('Users').updateOne({username: username, email: email}, {$set: {password: hash}});
	console.log(result.modifiedCount);

	if(result.modifiedCount != 0)
		res.status(200).json({error: ""});
	else {
		res.status(200).json({error: "user_not_found"});
	}
})

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
	const username = sanitize(req.body.username);
	const password = sanitize(req.body.password);
	const email = sanitize(req.body.email);

	const oauth2Client = new OAuth2(
     process.env.clientID, // ClientID
     process.env.clientSecret, // Client Secret
     "https://developers.google.com/oauthplayground" // Redirect URL
	);

	oauth2Client.setCredentials({
     refresh_token: process.env.refreshToken
	});
	const accessToken = oauth2Client.getAccessToken();

	const smtpTransport = nodemailer.createTransport({
     service: "gmail",
     auth: {
          type: "OAuth2",
          user: "COP4331largeproject@gmail.com",
          clientId: process.env.clientID,
          clientSecret: process.env.clientSecret,
          refreshToken: process.env.refreshToken,
          accessToken: accessToken
     }});

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
					secure: true,
					user: 'COP4331largeproject@gmail.com',
					pass: process.env.DBPASSWORD
				}
		});

		var mailOptions = {
			from: 'COP4331largeproject@gmail.com',
			to: `${email}`,
			subject: 'Email Verification',
			text: `Please go to https:largeprojectapifoodmanager.herokuapp.com/api/emailverification/?veri=${code} to verify your account!`
		};

		smtpTransport.sendMail(mailOptions, function(error, info){
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
  * api/allrecipes:
  *   get:
  *     tags:
  *       - All Recipes
  *     name: All Recipes
  *     summary: Gets all recipes from the DB
  *     parameters:
  *       - name: Authorization
  *         in: header
  *         schema:
  *           type: object
  *           properties:
  *             Authorization:
  *               type: string
  *         required:
  *           - Authorization
  *     produces:
  *       - application/json
  *     consumes:
  *       - application/json
  *     responses:
  *       200:
  *         description: Success
  *         schema:
  *           type: object
  *           properties:
  *             token:
  *               results: string
  *             required:
  *               - token
  */
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

 /**
  * @swagger
  * api/userrecipes:
  *   get:
  *     tags:
  *       - All Recipes associated with user
  *     name: All Recipes per User
  *     summary: Gets all recipes from the DB associated with a user
  *     parameters:
  *       - name: Authorization
  *         in: header
  *         schema:
  *           type: object
  *           properties:
  *             Authorization:
  *               type: string
  *         required:
  *           - Authorization
  *       - name: username
  *         in: query
  *           type: string
  *     produces:
  *       - application/json
  *     consumes:
  *       - application/json
  *     responses:
  *       200:
  *         description: Success
  *         schema:
  *           type: object
  *           properties:
  *             token:
  *               results: string
  *             required:
  *               - token
  */
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

/**
 * @swagger
 * /api/createrecipe:
 *   post:
 *     tags:
 *       - CreateRecipe
 *     description: Creates a recipe and stores it in the db
 *     parameters:
 *       - name: title
 *         description: Title of the recipe
 *         in: body
 *         required: true
 *         type: string
 *       - name: description
 *         description: description of the recipes
 *         in: body
 *         required: true
 *         type: string
 *       - name: servings
 *         description: number of servings in the recipe
 *         in: body
 *         required: true
 *         type: integer
 *       - name: time
 *         description: amount of time required to make the recipe
 *         in: body
 *         required: true
 *         type: string
 *       - name: store
 *         description: place to purchase the ingredients
 *         in: body
 *         required: true
 *         type: string
 *       - name: creator
 *         description: person who created the recipe
 *         in: body
 *         required: true
 *         type: string
 *       - name: ingredients
 *         description: array of ingredients
 *         in: body
 *         required: true
 *         type: array
 *       - name: steps
 *         description: array of steps
 *         in: body
 *         required: true
 *         type: array
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: error values
 */
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

/**
 * @swagger
 * /api/deleterecipe:
 *   post:
 *     tags:
 *       - Delete Recipe
 *     description: Deletes a recipe
 *     parameters:
 *       - name: title
 *         description: Recipe's name
 *         in: body
 *         required: true
 *         type: string
 *       - name: creator
 *         description: Recipe's Creator
 *         in: body
 *         required: true
 *         type: string
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: error values
 */
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

/**
 * @swagger
 * /api/searchrecipe:
 *   post:
 *     tags:
 *       - Search Recipe
 *     name: Search Recipe
 *     summary: Searches a recipe
 *     produces:
 *       - application/json
 *     consumes:
 *       - application/json
 *     parameters:
 *       - name: body
 *         in: body
 *         schema:
 *           type: object
 *           properties:
 *             title:
 *               type: string
 *           required:
 *             - title
 *     response:
 *       200:
 *         description: Searched
 *         schema:
 *           type: object
 *           properties:
 *             results:
 *               type: object
 *             error:
 *               type: string
 *             required:
 *               - results
 */
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

/**
 * @swagger
 * /api/modifyrecipe:
 *   post:
 *     tags:
 *       - Modify Recipe
 *     description: Modifies a recipe and stores it in the db
 *     parameters:
 *       - name: title
 *         description: Title of the recipe
 *         in: body
 *         required: true
 *         type: string
 *       - name: description
 *         description: description of the recipes
 *         in: body
 *         required: true
 *         type: string
 *       - name: servings
 *         description: number of servings in the recipe
 *         in: body
 *         required: true
 *         type: integer
 *       - name: time
 *         description: amount of time required to make the recipe
 *         in: body
 *         required: true
 *         type: string
 *       - name: store
 *         description: place to purchase the ingredients
 *         in: body
 *         required: true
 *         type: string
 *       - name: creator
 *         description: person who created the recipe
 *         in: body
 *         required: true
 *         type: string
 *       - name: ingredients
 *         description: array of ingredients
 *         in: body
 *         required: true
 *         type: array
 *       - name: steps
 *         description: array of steps
 *         in: body
 *         required: true
 *         type: array
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: error values
 */
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

	//const recipe = await db.collection('PublicRecipes').findOne({_id: _id});

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

	const result = await db.collection('PublicRecipes').updateOne({title: title}, update, { upsert: false });

	res.status(200).json({error: ""});
});

/**
 * @swagger
 * api/login:
 *   post:
 *     tags:
 *       - Login
 *     name: Login
 *     summary: Logs a user in by passing a JWT
 *     produces:
 *       - application/json
 *     consumes:
 *       - application/json
 *     parameters:
 *       - name: body
 *         in: body
 *         schema:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *             password:
 *               type: string
 *           required:
 *             - username
 *             - password
 *     responses:
 *       200:
 *         description: Logged in
 *         schema:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *             required:
 *               - token
 */
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
