const http 				= require('http');
const https 			= require('https');
const createError 		= require('http-errors');
const express 			= require('express');
const path 				= require('path');
const cookieParser 		= require('cookie-parser');
const logger 			= require('morgan');
const request 			= require('request');
const Session 			= require('express-session')
const flash 			= require('connect-flash');
const csrf 				= require('csurf')
const fs 				= require('fs');
const ini 				= require('ini');
const crypto 			= require('crypto');
const uuidv4 			= require('uuid/v4');
const Big 				= require('big.js');
const {promisify} 		= require('util');
const asyncv3	  		= require('async');
const sharedsession		= require('socket.io-express-session');
const redis 			= require('redis');
var QRCode				= require('qrcode');
var lodash				= require('lodash');



const redisClient 		= redis.createClient();
const redisStore 		= require('connect-redis')(Session);


var ini_config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

// Database
var db;

var rclient = redis.createClient(ini_config.redis_port, ini_config.redis_host, {detect_buffers: true});
var rclientpubsub = redis.createClient(ini_config.redis_port, ini_config.redis_host, {detect_buffers: true});

const hgetAsync = promisify(rclient.hget).bind(rclient);
const hsetAsync = promisify(rclient.hset).bind(rclient);
const getAsync  = promisify(rclient.get).bind(rclient);
const setAsync  = promisify(rclient.set).bind(rclient);
const delAsync  = promisify(rclient.del).bind(rclient);
const incrbyAsync  = promisify(rclient.incrby).bind(rclient);


var session = Session({
  secret: ini_config.session_secret,
  name: '_pwaboiler',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }, // Note that the cookie-parser module is no longer needed
  store: new redisStore({ host: ini_config.redis_host, port: ini_config.redis_port, client: redisClient, ttl: 864000 }),
});

var indexRouter = require('./routes/index');

var serverPort = 8181; //ini_config.server_port;

var app = express();
var server = http.createServer(app);

app.set('trust proxy', 1);
app.use(session);

var io = require('socket.io').listen(server);
io.use(sharedsession(session, { autoSave:true }));

server.listen(serverPort);

////
// Web Stuff

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(csrf());
app.use(flash());
app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


////
// Socket IO Stuff

io.on('connection', function (socket) {
	
	var sessionId = socket.handshake.session.id;
	
	
	if (socket.handshake.session.user && socket.handshake.session.user.id != '')
	{
		// Logged In User
	

	}
	else
	{

		// Not logged
		
	}
		

    

    socket.on('something', function(input) {
    
    	socket.emit('something');
    
    });
    

	

    
});




////
// These functions are used for storing sensitive information in the DB

function encrypt(text) {
  var cipher = crypto.createCipheriv('aes-256-gcm', ini_config.crypt_pass, ini_config.crypt_iv)
  var encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex');
  var tag = cipher.getAuthTag();
  return {
    content: encrypted,
    tag: tag
  };
}

function decrypt(encrypted) {
  var decipher = crypto.createDecipheriv('aes-256-gcm', ini_config.crypt_pass, ini_config.crypt_iv)
  decipher.setAuthTag(encrypted.tag);
  var dec = decipher.update(encrypted.content, 'hex', 'utf8')
  dec += decipher.final('utf8');
  return dec;
}
