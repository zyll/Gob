/**
 *
*/
// Required system libraries
var http    = require('http')
  , jade = require('jade')
  , express = require('express')
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
  , boards = new Boards(db)

  /*
* @todo rely on an object to catch save event
boards.on('board:save', function(data) {
    console.log('me')
})
*/

var server = express.createServer(
    express.static(__dirname + '/public'),
    express.bodyParser(),
    express.router(function(app) {

        /**
        * Home
        */
        app.get('/', function(req, res, next) {
            res.render('home')
        })

        /**
         * Boards list
         */
        app.get('/boards', function(req, res, next) {
            boards.all(function(err, boards) {
                res.render('boards/all', {locals: {boards: boards}})
            })
        })

        /**
         * Get form to create a board
         */
        app.get('/board', function(req, res, next) {
            res.render('boards/form')
        })

        /**
         * New board, empty (as in no stack)
         * @params slug {String} the board slug
         * @return 302 Redirect on created, content-location headers point to the new board.
         */
        app.post('/board', function(req, res, next) {
            new Board(db, {name: req.param('name'), boards: boards})
                .save(function(err, board) {
                    res.redirect(board.url())
                })
        })

        /**
         * Getting a board by it's slug
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board', function(req, res, next) {
            boards.get({slug: escape(req.param('board'))}, function(err, board) {
                if(!err && board) {
                    board.all(function(err, stacks) {
                        if(stacks.length == 0) {
                            return res.render('boards/item', {locals: {board: board}, layout: false})
                        }
                        board.stacks = stacks
                        var stack_todo = stacks.length
                        stacks.forEach(function(stack) {
                            stack.all(function(err, stickies) {
                                stack.stickies = stickies
                                if(--stack_todo < 1) {
                                    res.render('boards/item', {locals: {board: board}, layout: false})
                                }
                            })
                        })
                    })
                } else {
                    res.send(404)
                }
            })
        })

        /**
         * Get form to create a Stack
         * @return 404 Not found, board doesn't exist.
         */
        app.get('/board/:board/stack', function(req, res, next) {
            boards.get({slug: escape(req.params.board)}, function(err, board) {
                if(err || !board) {
                    res.send(404)
                } else {
                    res.render('stacks/form', {locals: {board: board}})
                }
            })
        })

        /**
         * Add stack to a board.
         * @return 302 Redirect, on created, content-location headers point to the new stack.
         * @return 404 Not found, board doesn't exist.
         */
        app.post('/board/:board/stack', function(req, res, next) {
            boards.get({slug: escape(req.params.board)}, function(err, board) {
                if(err || !board) {
                    res.send(404)
                } else {
                    new Stack(db, {name: req.body.name, board: board})
                        .save(function(err, stack) {
                            res.redirect(stack.url())
                        })
                }
            })
        })

        /**
         * Getting a stack by it's slug
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board/stack/:stack', function(req, res, next) {
            console.log(req.params.stack, req.params.board)
            new Board(db, {slug: escape(req.params.board)})
                .get({slug: escape(req.params.stack)}, function(err, stack) {
                    if(!err && stack) {
                        res.render('stacks/item.jade', {locals: {stack: stack}})
                    } else {
                        res.send(404)
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
         */
        app.post('/board/:board/stack/:stack/sticky', function(req, res, next) {
            new Board(db, {slug: req.body.board})
                .get({slug: stack}, function(err, stack) {
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
        })

        /**
         * Getting a sticky by it's slug
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
    express.logger()
)
server.set('view engine', 'jade');

boards.init(function(err, res) {
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

