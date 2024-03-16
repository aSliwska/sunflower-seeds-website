module.exports = function(app) {
    app.get('/', function(req,res) {
        res.sendFile(__dirname + '/index.html')
    });

    app.get('/animation', function(req, res) {
        res.sendFile(__dirname + '/views/animation.html')
    });
    
    app.get('/movie', function(req, res) {
        res.sendFile(__dirname + '/views/movie.html')
    });
    
    app.get('/register', function(req,res) {
        res.sendFile(__dirname + '/views/register.html')
    });
    
    app.get('/login', function(req,res) {
        res.sendFile(__dirname + '/views/login.html')
    });
};