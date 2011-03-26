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
  , libBoard = require('./lib')
  , io = require('socket.io')
  , BoardsFactory = libBoard.BoardsFactory
  , Board = libBoard.Board

    require("socket.io-connect");

var tpls = __dirname + '/jade'

var boards = new BoardsFactory(__dirname + '/boards', function(err) {
    if(err) {
        console.log(err)
    } else {
        for(var i in boards.boards) {
            console.log('board ' + boards.boards[i].name + ' loaded')
        }
    }
})
boards.on('board:save', function(data) {
    console.log('me')
})

var server = Connect.createServer(
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
                jade.renderFile(tpls + '/boards.jade', {locals: {boards: boards.all()}}, function(err, html) {
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
            if(board.find(req.body.name)) {
                    res.writeHead(404)
                    res.send("already exist")
            } else {
                var board = boards.add(req.body.name)
                board.create(function(err) {
                    if(err) {
                        res.writeHead(404)
                    } else {
                        // return layout + empty board
                        jade.renderFile(tpls + '/board.jade', {locals: {board: board}}, function(err, html) {
                            res.end(html)
                        })
                    }
                })
            }
        })

        // Getting a board
        app.get('/board/:id', function(req, res, next) {
            var board = boards.find(req.params.id)
            if(!board) {
                res.writeHead(404)
                res.end()
            } else {
                jade.renderFile(tpls + '/board.jade', {locals: {board: board}}, function(err, html) {
                   res.end(html)
                })
            }
        })

        // Saving a board.
        app.post('/board/:id', function(req, res, next) {
            var board = boards.find(req.params.id)
            if(board) {
                var xml = ''
                req.on('data', function(d) {xml += d})
                req.on('end', function() {
                    board.save(xml, function(err) {
                        if(err) {
                            res.writeHead(404)
                        }
                        res.end()
                    })
                })
            } else {
                res.writeHead(404)
                res.end()
            }
        })
        
        // do deploy on a board.
        app.post('/board/:id/deploy', function(req, res, next) {
            console.log('wanna deploy' + req.params.id)
            var board = boards.find(req.params.id)
            if(board) {
                board.deploy(function(err) {
                    if(err) {
                        console.log('unable to deploy', req.params.id)
                        res.writeHead(404)
                    }
                    res.end()
                })
            } else {
                res.writeHead(404)
                res.end()
            }
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
)
server.listen(3000);

var socket = io.listen(server);
socket.on('connection', socket.prefixWithMiddleware( function (client, req, res) {

    var listen_board = null
    listen_func = null

    client.on('message', function(message){
        if(message.board && listen_board != message.board) {
            listen_board = message.board
            if(listen_func) {
                boards.removeListener('board:save', listen_func)
            }
            listen_func = function(board) {
                if(board.name == listen_board) {
                    client.send({change: true})
                }
            }
            boards.on('board:save', listen_func)
        }
    });

    client.on('disconnect', function(){
        var listen_board = null
        if(listen_func) {
            boards.removeListener('board:save', listen_func)
        }
        listen_func = null
        console.log('disconnect')
    });
}));

console.log('up and ready on http://localhost:3000')
