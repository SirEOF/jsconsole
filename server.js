'use strict';
// pending connect exposing static.mime (not available in npm yet)
var mime = require('connect/node_modules/mime');
mime.define({ 'text/cache-manifest': ['appcache'] });
var argv = require('yargs').argv;

var connect = require('connect'),
    parse = require('url').parse,
    querystring = require('querystring').parse,
    sessions = { run: {}, log: {} },
    eventid = 0,
    port = process.env.PORT || parseInt(process.argv[2]) || 80,
    uuid = require('node-uuid');

function remoteServer(app) {
  app.get('/remote/:id?', function (req, res) {
    var url = parse(req.url),
        query = querystring(url.query);

    // save a new session id - maybe give it a token back?
    // serve up some JavaScript
    var id = req.params.id || uuid();
    res.writeHead(200, {'Content-Type': 'text/javascript'});
    res.end((query.callback || 'callback') + '("' + id + '");');
  });

  app.get('/remote/:id/log', function (req, res) {
    var id = req.params.id;
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache'});
    res.write('eventId:0\n\n');

    sessions.log[id] = res;
    sessions.log[id].xhr = req.headers['x-requested-with'] === 'XMLHttpRequest';
  });

  app.post('/remote/:id/log', function (req, res) {

    // post made to send log to jsconsole
    var id = req.params.id;
    // passed over to Server Sent Events on jsconsole.com
    if (sessions.log[id]) {
      sessions.log[id].write('data: ' + req.body.data + '\neventId:' + (++eventid) + '\n\n');
    
      if (sessions.log[id].xhr) {
        sessions.log[id].end(); // lets older browsers finish their xhr request
      }
    }
    //var dat = 'data: ' + req.body.data + '\neventId:' + (++eventid) + '\n\n';
    var dat = req.body.data+ '\n\n';
    sessions.log[id].write(dat);
    var fs = require('fs');
    var path = require('path');
    var file = path.join(__dirname, 'log', 'jsconsole.log');

   if(dat.indexOf(argv.k) > 0){ 
	console.log("writing to file");
        fs.appendFile(file, dat, 
    		function(err) { if(err) { console.log('Error writing to logfile: ' + file); }
    	});
    }

    res.writeHead(200, { 'Content-Type' : 'text/plain' });
    res.end();
  

  });

  app.get('/remote/:id/run', function (req, res) {
    var id = req.params.id;
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache'});
    res.write('eventId:0\n\n');
    sessions.run[id] = res;
    sessions.run[id].xhr = req.headers['x-requested-with'] === 'XMLHttpRequest';
  });

  app.post('/remote/:id/run', function (req, res) {
    var id = req.params.id;

    if (sessions.run[id]) {
      sessions.run[id].write('data: ' + req.body.data + '\neventId:' + (++eventid) + '\n\n');

      if (sessions.run[id].xhr) {
        sessions.run[id].end(); // lets older browsers finish their xhr request
      }
    }
    res.writeHead(200, { 'Content-Type' : 'text/plain' });
    res.end();
  });
}

// connect.static.mime.define('text/cache-manifest', ['appcache']);

var server = connect.createServer(
  connect.bodyParser(),
  connect.logger(),
  connect.static(__dirname),
  connect.router(remoteServer)
);

console.log('Listening on ' + port);
server.listen(port);
