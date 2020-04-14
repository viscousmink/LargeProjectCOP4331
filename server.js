require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const database = require('./database.js');
const path = require('path');

const app = express();
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
	info: {
		title: 'Food Manager UCF API',
		version: '1.0.0',
		description: 'API for the Food Manager COP4331 Large Project'
	},
	host: 'https://largeprojectapifoodmanager.herokuapp.com/',
	basePath: '/'
};

const options = {
	swaggerDefinition: swaggerDefinition,
	apis: ['./API/*.js']
}

var swaggerSpec = swaggerJSDoc(options);

app.get('/swagger.json', function(req, res) {
	res.setHeader('Content-Type', 'application/json');
	res.send(swaggerSpec);
})

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/api', require('./API/app.js'));

// Serve any static files
//app.use(express.static(path.join(__dirname, 'frontend', 'build')));

// Handle React routing, return all requests to React app
app.get('/*', (req, res) => {
	// res.sendFile('/frontend/public/index.html', { root: __dirname });
	// res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
	res.sendFile('/index.html', { root: __dirname});
});

// const PORT = process.env.PORT;
// app.listen(PORT, () => console.log('Wizardous stuff on ' + PORT));

const port = process.env.PORT || 8000;
app.listen(port);

console.log(`Wizardous stuff on ${port}`);
