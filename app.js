/**
 *
*/
// Required system libraries
var http    = require('http')
  , fs = require('fs')
  , jade = require('jade')
  , Connect = require('connect')
  , sys = require('sys')
  , libBoard = require('./lib')
  , io = require('socket.io')
  , Boards = libBoard.Boards
  , Board  = libBoard.Board
  , Stack  = libBoard.Stack
  , Sticky = libBoard.Sticky

    require("socket.io-connect");

var tpls = __dirname + '/jade'
  , db = Boards.client({name: 'dev_boards'})
  // make it globals (is that a fixme ?)
  , boards = null

  /*
* @todo rely on an object to catch save event
boards.on('board:save', function(data) {
    console.log('me')
})
*/

var server = Connect.createServer(
    Connect.static(__dirname + '/public'),
    Connect.bodyParser(),
    Connect.router(function(app) {

        /**
        * Home
        */
        app.get('/', function(req, res, next) {
            jade.renderFile(tpls + '/home.jade', function(err, html) {
               res.end(html)
            })
        })

        /**
         * Boards list
         */
        app.get('/boards', function(req, res, next) {
            boards.all(function(err, boards) {
                // maah... won't have any error here :)
                jade.renderFile(tpls + '/boards/all.jade', {locals: {boards: boards}}, function(err, html) {
                   res.end(html)
                })
            })
        })

        /**
         * Get form to create a board
         */
        app.get('/board', function(req, res, next) {
            jade.renderFile(tpls + '/boards/form.jade', function(err, html) {
               res.end(html)
            })
        })

        /**
         * New board, empty (as in no stack)
         * @params name {String} the board name
         * @return 409 Conflict on already exist
         * @return 302 Redirect on created, content-location headers point to the new board.
         */
        app.post('/board', function(req, res, next) {
            boards.get({name: req.body.name}, function(err, board){
                if(board) {
                    res.writeHead(409)
                    res.send()
                } else {
                    new Board(db, {name: req.body.name, boards: boards})
                        .save(function(err, board) {
                            // don't bother about save fail.
                            res.writeHead(302, {
                                'Location': board.url()
                            });
                            res.end();
                        })
                }
            })
        })

        /**
         * Getting a board by it's name
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:name', function(req, res, next) {
            boards.get({name: req.params.name}, function(err, board){
                if(board) {
                    jade.renderFile(tpls + '/boards/item.jade', {locals: {board: board}}, function(err, html) {
                       res.end(html)
                    })
                } else {
                    res.writeHead(404)
                    res.send()
                }
            })
        })

        /**
         * Get form to create a Stack
         */
        app.get('/board/:board/stack', function(req, res, next) {
            jade.renderFile(tpls + '/stacks/form.jade', function(err, html) {
               res.end(html)
            })
        })

        /**
         * Add stack to a board.
         * @return 302 Redirect, on created, content-location headers point to the new stack.
         * @return 404 Not found, board doesn't exist.
         * @return 409 Conflict, on stack already exist.
         */
        app.post('/board/:name/stack', function(req, res, next) {
            boards.get({name: req.body.name}, function(err, board) {
                if(board) {
                    res.writeHead(409)
                    res.send()
                } else {
                    new Stack(db, {name: req.body.name, board: board})
                        .save(function(err, stack) {
                            // don't bother about save fail.
                            res.writeHead(302, {'Location': stack.url()});
                            res.end();
                        })
                }
            })
        })

        /**
         * Getting a stack by it's name
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board/stack/:stack', function(req, res, next) {
            new Stack(db, {
                    name: req.params.stack,
                    board: {
                        name: req.params.board
                    }
                }, function(err, stack) {
                if(stack) {
                    jade.renderFile(tpls + '/stacks/item.jade', {locals: {stack: stack}}, function(err, html) {
                       res.end(html)
                    })
                } else {
                    res.writeHead(404)
                    res.send()
                }
            })
        })

        /**
         * Get form to create a Sticky
         */
        app.get('/board/:board/stack/:stack/sticky', function(req, res, next) {
            jade.renderFile(tpls + '/stickies/form.jade', function(err, html) {
               res.end(html)
            })
        })

        /**
         * Add sticky to a stack.
         * @return 302 Redirect, on created, content-location headers point to the new sticky.
         * @return 404 Not found, board or stack doesn't exist.
         * @return 409 Conflict, on sticky already exist.
         */
        app.post('/board/:board/stack/:stack/sticky', function(req, res, next) {
            var stack = new Stack(db, {
                name: req.body.stack,
                board: {
                    name: req.body.board
                }})
            stack.get({name: req.body.sticky}, function(err, sticky) {
                if(sticky) {
                    res.writeHead(409)
                    res.send()
                } else {
                    stack.board.get(stack, function(err, stack) {
                        if(!err && stack) {
                            new Sticky(db, {name: req.body.sticky, stack: stack})
                                .save(function(err, sticky) {
                                    res.writeHead(302, {'Location': sticky.url()});
                                    res.end();
                                })
                        } else {
                            res.writeHead(500)
                            res.end()
                        }
                    })
                }
            })
        })

        /**
         * Getting a sticky by it's name
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board/stack/:stack/sticky/:sticky', function(req, res, next) {
            new Sticky(db, {
                name: req.params.sticky,
                stack: {
                    name: req.params.stack,
                    board: {
                        name: req.params.board
                }}}, function(err, sticky) {
                    if(!err && sticky) {
                        jade.renderFile(tpls + '/stickies/item.jade', {locals: {sticky: sticky}}, function(err, html) {
                           res.end(html)
                        })
                    } else {
                        res.writeHead(404)
                        res.send()
                    }
                }
            )
        })

        /**
         * do deploy on a board.
         * @return 404 Not found, on stack empty or unknown.
         * @return 302 Redirect, with the content location pointing to the deployed stack.
         */
        app.post('/board/:board/stack/:stack/deploy', function(req, res, next) {
            res.writeHead(501)
            res.end()
        })
    }),    
    Connect.logger()
)

new Boards(db, function(err, res) {
    boards = res
    server.listen(3000);
    console.log('up and ready on http://localhost:3000')
})


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

