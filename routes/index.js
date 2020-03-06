const express 		= require('express');
var router 			= express.Router();
var bcrypt 			= require('bcryptjs');
const uuidv4 		= require('uuid/v4');
const Validator 	= require("fastest-validator");
const v				= new Validator();
const redis 		= require('redis');
const {promisify} 	= require('util');
const fs 			= require('fs');
const ini 			= require('ini');
const Big 			= require('big.js');

var ini_config 		= ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

var rclient 		= redis.createClient(ini_config.redis_port, ini_config.redis_host, {detect_buffers: true});

const hgetAsync 	= promisify(rclient.hget).bind(rclient);
const hsetAsync 	= promisify(rclient.hset).bind(rclient);
const getAsync  	= promisify(rclient.get).bind(rclient);
const setAsync  	= promisify(rclient.set).bind(rclient);
const delAsync  	= promisify(rclient.del).bind(rclient);
const incrbyAsync  	= promisify(rclient.incrby).bind(rclient);

const qreditjs 		= require("qreditjs"); 


/* GET home page. */
router.get('/', function(req, res, next) {

  var user = null;
  
  if (req.session.user)
  	user = req.session.user;

  res.render('index', { title: 'pwaboiler', csrfToken: req.csrfToken(), sessionId: req.session.id, user: user, messages: req.flash() });
  
});


/* GET register page. */
router.get('/register', function(req, res, next) {

  var user = null;
  
  if (req.session.user)
  {
  	
  	res.redirect('/account');
  	
  }
  else
  {

  	res.render('register', { title: 'pwaboiler', csrfToken: req.csrfToken(), sessionId: req.session.id, user: user, messages: req.flash() });
  
  }
  
});

/* POST register page. */
router.post('/register', function(req, res, next) {

	var db = req.app.get('db');

	if (!req.body.email || !req.body.username || !req.body.password)
	{

		req.flash('error', 'Missing form information')
		res.redirect('/register');
	
	}
	
	var email = req.body.email;
	var username = req.body.username;
	var password = req.body.password;

	var eobj = { email: email };
	var emailvalid = v.validate(eobj, {email: { type: "email", trim: true }});
	if (!emailvalid)
	{

		req.flash('error', 'Email address invalid')
		res.redirect('/register');
	
	}

	var uobj = { username: username };
	var usernamevalid = v.validate(uobj, {username: { type: "string", min: 3, max: 15, trim: true, lowercase: true, alphanum: true}});
	if (!usernamevalid)
	{

		req.flash('error', 'Username invalid.  Alphanumeric only.  4 to 15 characters')
		res.redirect('/register');
	
	}

	var pobj = { password: password };
	var passwordvalid = v.validate(pobj, {password: { type: "string", min: 8, max: 30, trim: true}});

	if (!passwordvalid)
	{
	
		req.flash('error', 'Password should be between 8 and 30 characters')
		res.redirect('/register');
	
	}

	
	bcrypt.genSalt(10, function(err, salt) {
    	bcrypt.hash(pobj.password, salt, function(err, hash) {

			db.collection('users').find({ email: eobj.email }).toArray(function (err, edocs) {

				if (edocs.length > 0)
				{

					req.flash('error', 'Email not available, use a different email address')
					res.redirect('/register');
		
				}
				else
				{

					db.collection('users').find({ username: uobj.username }).toArray(function (err, udocs) {

						if (udocs.length > 0)
						{

							req.flash('error', 'Username not available, use a different username')
							res.redirect('/register');
		
						}
						else
						{

							var userid = uuidv4();
		
							var userdoc = {
										id: userid,
										username: uobj.username.toLowerCase(),
										password: hash,
										email: eobj.email.toLowerCase(),
										lastlogin: null,
										createdAt: new Date().toISOString(),
										updatedAt: new Date().toISOString()
										};

							db.collection('users').insertOne(userdoc, function (err, newDoc) {
					
								req.flash('notice', 'Registration Successful')
								res.redirect('/login');

							});

						}
	
					});
		
				}
	
			});
	
		});
	
	});

});

/* GET login page. */
router.get('/login', function(req, res, next) {

  var user = null;
  
  if (req.session.user)
  {
  	
  	res.redirect('/account');
  	
  }
  else
  {
  	
	res.render('login', { title: 'bit21 - Account Login', csrfToken: req.csrfToken(), sessionId: req.session.id, user: user, messages: req.flash() });
	
  }
  
});

router.post('/logout', function(req, res, next) {

	req.session.user = null;
	req.flash('notice', 'You have been logged out')
	res.redirect('/login');

});

/* POST login page. */
router.post('/login', function(req, res, next) {

	var db = req.app.get('db');
	
	var username = req.body.username;
	var password = req.body.password;
	
	if (username != '' && password != '')
	{
	
		db.collection('users').find({ $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }] }).toArray(function (err, docs) {



			if (err || docs.length == 0)
			{
				req.flash('error', 'Login Incorrect')
				res.redirect('/login');
			}
			else
			{

console.log(docs);

				var validpass = bcrypt.compareSync(password, docs[0].password);
			
				if (validpass == false)
				{
					req.flash('error', 'Login Incorrect')
					res.redirect('/login');
				}
				else
				{

					db.collection('users').updateOne({ id: docs[0].id }, { $set: { lastlogin: new Date().toISOString() } }, {}, function (err, numReplaced) { });

					req.session.user = docs[0];
					req.flash('notice', 'Login Successful')
					res.redirect('/account');
					
					
				}
		
			}

		});
	
	}
	else
	{

		req.flash('error', 'Empty Login Provided')
		res.redirect('/login');
	
	}

});


/* GET account page. */
router.get('/account', function(req, res, next) {

  var db = req.app.get('db');
  
  var user = null;
  
  if (req.session.user)
  {
  
  	user = req.session.user;
  	
	var balancestringxqr = 'userbal_xqr_' + user.id;
	var balancestringcgt = 'userbal_cgt_' + user.id;
	
	(async () => {
	
		userBalanceXqr = await getAsync(balancestringxqr);
		userBalanceCgt = await getAsync(balancestringcgt);
		
		if (!userBalanceXqr)
		{
			await setAsync(balancestringxqr, 0);
			userBalanceXqr = await getAsync(balancestringxqr);
		}
		
		if (!userBalanceCgt)
		{
			await setAsync(balancestringcgt, 0);
			userBalanceCgt = await getAsync(balancestringcgt);
		}
		
		db.collection('users').find({ id: user.id }).toArray(function (err, udocs) {

			if (udocs.length > 0)
			{
			
				udocs[0].createdAt = new Date(udocs[0].createdAt).toUTCString();

				res.render('account', { title: 'bit21 - Your Account', csrfToken: req.csrfToken(), sessionId: req.session.id, user: udocs[0], messages: req.flash(), xqrbalance: userBalanceXqr, cgtbalance: userBalanceCgt });
	
			}
			else
			{

				req.session.user = null;
				req.flash('notice', 'You have been logged out');
				res.redirect('/login');

			}
		
		});
		
	})();

  }
  else
  {
  	res.redirect('/login');
  }
  
});

router.post('/withdraw', function(req, res, next) {

  var db = req.app.get('db');
  
  var user = null;
  
  if (req.session.user)
  {
  
  	user = req.session.user;
  	
	var balancestring = 'userbal_xqr_' + user.id;

	(async () => {
	
		userBalance = await getAsync(balancestring);
	
		if (!userBalance)
		{
			await setAsync(balancestring, 0);
			userBalance = await getAsync(balancestring);
		}
		
		var wdaddress = req.body.wdaddress;
		var wdamount = req.body.wdamount;
		var password = req.body.password;
		
		try {

			var bigamount = Big(wdamount);
			
			var validaddress = qreditjs.crypto.validateAddress(wdaddress);
			
			if (bigamount.gt(userBalance))
			{

				req.flash('error', 'Insufficient Balance');
				res.redirect('/account');
			
			}
			else if (validaddress == false)
			{

				req.flash('error', 'Invalid Withdraw Address');
				res.redirect('/account');
				
			}
			else
			{
			
				await incrbyAsync(balancestring, Big(wdamount).times(-1).toFixed(0));
			
				var tid = uuidv4();
	
				var trxdoc = {
							id: tid,
							userid: user.id,
							address: wdaddress,
							currency: 'xqr',
							type: 'withdraw',
							amount: bigamount.toFixed(0),
							transactionid: null,
							status: 'pending',
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString()
							};

				db.collection('transactions').insertOne(trxdoc, function (err, newDoc) { });

				req.flash('notice', 'Received withdraw request for ' + bigamount.toFixed(0) + ' XQR');
				res.redirect('/account');

			}

		} catch (e) {

console.log(e);

			req.flash('error', 'An Error Occurred - Try Again');
			res.redirect('/account');
		
		}

		
	})();

  }
  else
  {
  	res.redirect('/login');
  }

});

module.exports = router;
