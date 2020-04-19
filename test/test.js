const expect  = require('chai').expect;
const request = require('request');

it('login content', function(done) {
    request('http://localhost:8000/api/allrecipes' , function(error, response, body) {
        expect(body).to.not.equal("");
        done();
    });
});
