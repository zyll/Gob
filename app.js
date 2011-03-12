/**
 *
*/
// Required system libraries
var http    = require('http')
  , fs = require('fs')
  , jade = require('jade')
  , Connect = require('connect')

var tpls = __dirname + '/jade'

Connect.createServer(
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
