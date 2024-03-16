const express = require('express');
const bodyParser= require('body-parser');
const jwt = require('jsonwebtoken');
const mongodb = require('mongodb');
const Transform = require("stream").Transform;
const fs = require('fs');
var db;

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const dbname = '********';
const url = 'mongodb:********';

mongodb.MongoClient.connect(url, function(err, client) {
	if (err) 
        return console.log(err)
	db = client.db(dbname);
	console.log('db connection ok');
});

app.listen(1577,function() {
	console.log('listening on 1577')
});

app.use(express.static(__dirname + '/'));





const accessTokenSecret = '********';
const refreshTokenSecret = '********'; 
var refreshTokens = [];

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
  
    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, accessTokenSecret, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
}

app.post('/register', (req, res) => {
    const { login, pass } = req.body;
  
    // check if no one has the same username
    db.collection('ns_users').findOne({username: login}, function(error, result) {
        if (result !== null) {
            res.end('login taken');
        }
        else {
            // add user
            db.collection('ns_users').insertOne({username: login, password: pass, parameters : []});

            // log in user
            const accessToken = jwt.sign({ username: login }, accessTokenSecret, { expiresIn: '5m' });
            const refreshToken = jwt.sign({ username: login }, refreshTokenSecret, { expiresIn: '24h' });
    
            refreshTokens.push(refreshToken);
    
            res.json({
                accessToken,
                refreshToken
            });
        }
    });
});

app.post('/login', (req, res) => {
    const { login, pass } = req.body;

    db.collection('ns_users').findOne({username: login, password: pass}, function(err,result) {
        if (err) {
            res.sendStatus(500);
        }
        else if (result == null) {
            res.end("wrong credentials")
        }
        else {
            const accessToken = jwt.sign({ username: login }, accessTokenSecret, { expiresIn: '5m' });
            const refreshToken = jwt.sign({ username: login }, refreshTokenSecret, { expiresIn: '24h' });
    
            refreshTokens.push(refreshToken);

            res.json({
                accessToken,
                refreshToken
            });
        }
    });
});
  
app.post('/token', (req, res) => {
    const token = req.body.token;
  
    if (!token) {
        return res.sendStatus(401);
    }
  
    if (!refreshTokens.includes(token)) {
        return res.sendStatus(403);
    }
  
    jwt.verify(token, refreshTokenSecret, (err, response) => {
        if (err) {
            return res.sendStatus(403);
        }
  
        const accessToken = jwt.sign({ username: response.username }, accessTokenSecret, { expiresIn: '5m' });
        
        res.json({
            accessToken
        });
    });
});
  
app.post('/logout', (req, res) => {
    const token = req.body.token;
    refreshTokens = refreshTokens.filter(t => t !== token);
  
    res.end("ok");
});

app.post('/parameters', authenticateJWT, function( req,res ) {
    const user = req.user;
    const params = req.body;

    if (params.name == '')
        res.end('name taken');
    else {
        db.collection('ns_users').findOne({ "username": user.username, "parameters.name": params.name }, function(err, user_res) {
            if (err) {
                res.sendStatus(500);
            }
            else if (user_res !== null) {
                res.end('name taken');
            }
            else {
                db.collection('ns_users').updateOne({ username: user.username }, { $push: { parameters: params } }, {}, function(err,result) {
                    if (err) {
                        res.sendStatus(500);
                    } else {
                        res.end('ok');
                    }
                });
            }
        });
    }
});

app.delete('/parameters/:name', authenticateJWT, function(req, res) {
    const user = req.user;

	db.collection('ns_users').updateOne({ username: user.username }, { $pull: {parameters: { name: req.params.name}} }, function(err,result) {
		if (err || result.deletedCount == 0)
            res.sendStatus(500);
        else 
            res.end('ok');
	});
});

app.get('/log_check', authenticateJWT, function( req,res ) {
    res.end("ok");
});

const routes = require('./routes')(app);

app.get('/profile', authenticateJWT, function(req,res) {
    // find user in database
    // send modified html with their saved parameters

    const user = req.user;
    var div_content = '';
    
    db.collection('ns_users').findOne({username: user.username}, {_id:0, parameters:1}, function(err, params_res) {
        
        for (let i = 0; i < params_res.parameters.length; i += 1) {
            let params = params_res.parameters[i];

            div_content += `<div id="parameters_box_${params.name}" class="center floating_box" style="width: 200px">
                <text class="underline">${params.name}</text>
                <text style="align-self: flex-start; font-size: 13px;">
                    Pokaż centrum: ${params.visible_center}<br/>
                    Szybkość animacji: ${params.animation_speed}<br/>
                    Rozmiar nasion: ${params.seed_size}<br/>
                    Kolor nasion: ${params.seed_color}<br/>
                    Kolor tła: ${params.background_color}<br/>
                    START: ${params.start_angle}<br/>
                    KONIEC: ${params.end_angle}
                </text>
                <div class="flex_wrapper" style="flex-direction: row;">
                    <input class="pretty_input" type="button" value="Załaduj" onclick="loadParameters('${params.name}')"/>
                    <input class="pretty_input" type="button" value="Usuń" onclick="deleteParameters('${params.name}')"/>
                </div>
            </div>`;
        }

        const replacementTransform = new Transform();
        replacementTransform._transform = function(data, encoding, done) {
            const str = data.toString().replace('<div class="flex_wrapper center" style="flex-direction: row; row-gap: 20px;"></div>', 
            `<div class="flex_wrapper center" style="flex-direction: row; row-gap: 20px;">`+div_content+`</div>`);

            this.push(str);
            done();
        }

        res.write('<!-- Begin stream -->\n');
        let stream = fs.createReadStream('./views/profile.html');
        stream.pipe(replacementTransform)
            .on('end', () => {
                res.write('\n<!-- End stream -->');
            })
            .pipe(res);
    });    
});

app.get('/animation/:name', authenticateJWT, function(req,res) {
    // get parameters
    const user = req.user;

	db.collection('ns_users').findOne({ "username": user.username, "parameters.name": req.params.name }, {_id:0, 'parameters.$':1},  function(err,result) {
		if (err || result == null)
            res.sendStatus(500);
        else {
            let params = result.parameters[0];

            let parameters_content = `<table id="parameters_table_replacable">
                <tr>
                    <td>Pokaż centrum:</td>
                    <td><input id="show_center" type="checkbox"${(params.visible_center ? ' checked' : '')} onchange="showCenter(this.checked)"/></td>
                    <td></td>
                </tr>
                <tr>
                    <td>Szybkość animacji:</td>
                    <td><input id="speed_slider" class="slider" type="range" min="0.1" max="10" step="0.1" value="${params.animation_speed}" oninput="speed_value.value=this.value"/></td>
                    <td style="width: 35px;"><output id="speed_value" for="speed_slider">${params.animation_speed}</output></td>
                </tr>
                <tr>
                    <td>Rozmiar nasion:</td>
                    <td><input id="seed_size_slider" class="slider" type="range" min="1" max="10" step="1" value="${params.seed_size}" oninput="seed_size_value.value=this.value" onchange="changeSeedSize(this.value)"/></td>
                    <td><output id="seed_size_value" for="seed_size_slider">${params.seed_size}</output></td>
                </tr>
                <tr>
                    <td>Kolor nasion:</td>
                    <td><input id="seed_color" class="pretty_color_picker" type="color" value="${params.seed_color}" onchange="changeSeedColor(this.value)"/></td>
                    <td></td>
                </tr>
                <tr>
                    <td>Kolor tła:</td>
                    <td><input id="background_color" class="pretty_color_picker" type="color" value="${params.background_color}" onchange="changeBackgroundColor(this.value)"/></td>
                    <td></td>
                </tr>
                <tr>
                    <td>START:</td>
                    <td><input id="start_value" type="number" form="" value="${params.start_angle}" min="0" max="1" step="0.000001"/></td>
                    <td></td>
                </tr>
                <tr>
                    <td>KONIEC:</td>
                    <td><input id="end_value" type="number" form="" value="${params.end_angle}" min="0" max="1" step="0.000001"/></td>
                    <td></td>
                </tr>
            </table>`;

            let ccenter_content = (params.visible_center ? `<circle id="ccenter" cx="300" cy="300" r="1" stroke="black" stroke-width="1"/>` : '<circle id="ccenter" cx="300" cy="300" r="1" stroke="black" stroke-width="1" style="display: none;"/>');
            let size_content = `r="${params.seed_size}"`;
            let color_content = `stroke="${params.seed_color}"`;
            let background_content = `<svg encoding="utf-8" id="svg_box" class="left_column" width="600" height="600" xmlns="http://www.w3.org/2000/svg" style="background-color: ${params.background_color}">`;

            const replacementTransform = new Transform();
            replacementTransform._transform = function(data, encoding, done) {
                const str = data.toString().replace(/<table id="parameters_table_replacable">(.|\n)*?<\/table>/, parameters_content)
                    .replace(`<circle id="ccenter" cx="300" cy="300" r="1" stroke="black" stroke-width="1"/>`, ccenter_content)
                    .replaceAll(`r="3"`, size_content)
                    .replaceAll(`stroke="black"`, color_content)
                    .replace(`<svg encoding="utf-8" id="svg_box" class="left_column" width="600" height="600" xmlns="http://www.w3.org/2000/svg">`, background_content);

                this.push(str);
                done();
            }

            res.write('<!-- Begin stream -->\n');
            let stream = fs.createReadStream('./views/animation.html');
            stream.pipe(replacementTransform)
                .on('end', () => {
                    res.write('\n<!-- End stream -->');
                })
                .pipe(res);
        }
	});

    // edit html file

});

