/**
 *
*/
// Required system libraries
var http    = require('http')
  , fs = require('fs')
  , jade = require('jade')
  , Connect = require('connect')
  , sys = require('sys')

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
            // new repos
            fs.mkdir(__dirname + '/boards/' + req.body.name, '766', function(err) {
                console.log('repos created')
                // compile an empty board
                jade.renderFile( tpls + '/board_empty.jade', function(err, html) {
                    console.log('load empty')
                    // write the empty board in the new repos
                    fs.writeFile(__dirname + '/boards/' + req.body.name + '/index.html', html, 'utf-8', function(err) {
                        console.log('save index')
                        if(err) {
                            console.log(err)
                            res.writeHead(404)
                        } else {
                            // return layout + empty board
                            console.log('render index')
                            jade.renderFile(tpls + '/board.jade', {locals: {name: req.body.name, board: html}}, function(err, html) {
                               res.end(html)
                            })
                        }
                    })
                })
            })
        })

        // Getting a board
        app.get('/board/:id', function(req, res, next) {
            fs.readFile(__dirname + '/boards/'+req.params.id + '/index.html', function(err, data) {
                if(err) {
                    res.writeHead(404)
                    res.end()
                } else {
                    jade.renderFile(tpls + '/board.jade', {locals: {name: req.params.id, board: data}}, function(err, html) {
                       res.end(html)
                    })
                }
            })
        })

        // Saving a board.
        // @todo use the stream luke.
        app.post('/board/:id', function(req, res, next) {
            var b = ''
            req.on('data', function(d) {b += d})
            req.on('end', function() {
                fs.writeFile(__dirname + '/boards/' + req.params.id + '/index.html', b, 'utf-8', function(err) {
                    if(err) {
                        res.writeHead(404)
                    }
                    res.end()
                })
            })
        })
    }),
    Connect.logger(),
    Connect.static(__dirname + '/public')
).listen(3000);

console.log('up and ready on http://localhost:3000')
