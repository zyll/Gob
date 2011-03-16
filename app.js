/**
 *
*/
// Required system libraries
var http    = require('http')
  , fs = require('fs')
  , jade = require('jade')
  , Connect = require('connect')
  , sys = require('sys')
  , libxml = require('libxmljs')
  , Board = require('./lib').Board

var tpls = __dirname + '/jade'

Connect.createServer(
        Connect.bodyParser(),
        Connect.router(function(app) {

        // Home
        app.get('/', function(req, res, next) {
            jade.renderFile(tpls + '/home.jade', function(err, html) {
               res.end(html)
            })
        })

        // Boards list
        app.get('/boards', function(req, res, next) {
            fs.readdir(__dirname + '/boards', function(err, files) {
                jade.renderFile(tpls + '/boards.jade', {locals: {files: files}}, function(err, html) {
                   res.end(html)
                })
            })

        })

        // Get form to create a board
        app.get('/board', function(req, res, next) {
            jade.renderFile(tpls + '/board_form.jade', function(err, html) {
               res.end(html)
            })
        })

        // New board
        app.post('/board', function(req, res, next) {
            new Board(req.body.name)
                .create(function(err, html) {
                    if(err) {
                        console.log(err)
                        res.writeHead(404)
                    } else {
                        // return layout + empty board
                        jade.renderFile(tpls + '/board.jade', {locals: {name: req.body.name, board: html}}, function(err, html) {
                            res.end(html)
                        })
                    }
                })
        })

        // Getting a board
        app.get('/board/:id', function(req, res, next) {
            new Board(req.params.id)
                .load(function(err, html) {
                    if(err) {
                        res.writeHead(404)
                        res.end()
                    } else {
                        jade.renderFile(tpls + '/board.jade', {locals: {name: req.params.id, board: html}}, function(err, html) {
                           res.end(html)
                        })
                    }
                })
        })

        // Saving a board.
        app.post('/board/:id', function(req, res, next) {
            req.on('data', function(d) {xml += d})
            req.on('end', function() {
                new Board(req.params.id)
                    .save(xml, function(err) {
                        if(err) {
                            res.writeHead(404)
                        }
                        res.end()
                    })
            })
        })
        
        // do deploy on a board.
        app.post('/board/:id/deploy', function(req, res, next) {
            console.log('wanna deploy' + req.params.id)
            new Board(req.params.id)
                .deploy(function(err) {
                    if(err) {
                        console.log('unable to deploy', req.params.id)
                        res.writeHead(404)
                    }
                    res.end()
                })
        })

        // Getting board release list
        app.get('/board/:id/deploy', function(req, res, next) {
            fs.readdir(__dirname + '/boards/' + req.params.id, function(err, files) {
                var filtered = []
                files.forEach(function(file) {
                    if(file.substring(0, 'deployed-'.length) == 'deployed-') {
                        filtered.push(file)
                    }
                })
                jade.renderFile(tpls + '/deployed.jade', {locals: {name: req.params.id, files: filtered}}, function(err, html) {
                    res.end(html)
                })
            })
        })
    }),
    
    Connect.logger(),
    Connect.static(__dirname + '/public')
).listen(3000);

console.log('up and ready on http://localhost:3000')
