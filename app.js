/**
 *
*/
// Required system libraries
var http    = require('http')
  , jade = require('jade')
  , express = require('express')
  , io = require('socket.io')
  
  , Model = require('./models/board')

    require("socket.io-connect"); // ???

var model = new Model({name: 'dev_boards'})

  /*
* @todo rely on an object to catch save event
boards.on('board:save', function(data) {
    console.log('me')
})
*/

var server = express.createServer(
    express.static(__dirname + '/public'),
    express.logger(),
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
            new model.Board()
                .all(function(err, boards) {
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
            new model.Board({name: req.param('name')})
                .save(function(err, board) {
                    res.redirect(board.url())
                })
        })

        /**
         * Getting a board by it's slug
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board', function(req, res, next) {
            new model.Board()
                .get(escape(req.params.board), function(err, board) {
                if(!err && board) {
                    console.log(board.stacks)
                    return res.render('boards/item', {locals: {board: board}, layout: false})
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
            new model.Board()
                .get(escape(req.params.board), function(err, board) {
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
            new model.Board()
                .get(escape(req.params.board), function(err, board) {
                if(err || !board) {
                    res.send(404)
                } else {
                    board.stacksAdd(new model.Stack({name: req.body.name}))
                    board.save(function(err, stack) {
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
            new model.Stack({parent:{slug: escape(req.params.board)}})
                .get(escape(req.params.stack), function(err, stack) {
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
            new model.Stack({parent: {slug: escape(req.params.board)}})
                .get(escape(req.params.stack), function(err, stack) {
                    if(!err && stack) {
                        res.render('stickies/form', {locals: {stack: stack}, layout: req.isXMLHttpRequest})
                    } else {
                        res.send(404)
                    }
            })
        })

        /**
         * Add sticky to a stack.
         * @return 302 Redirect, on created, content-location headers point to the new sticky.
         * @return 404 Not found, board or stack doesn't exist.
         */
        app.post('/board/:board/stack/:stack/sticky', function(req, res, next) {
            new model.Board()
                .get(escape(req.params.board), function(err, board) {
                if(!err && board) {
                    var stack = board.stacksGet(escape(req.params.stack))
                    if(!stack) {
                        return res.send(404)
                    }
                    var sticky = new model.Sticky({
                        title: req.body.title,
                        content: req.body.content,
                        user: req.body.user,
                        stack: stack
                    })
                    stack.stickiesAdd(sticky)
                    board.save(function(err, board) {
                        if(err) {
                            return res.send(500)
                        }
                        res.redirect(sticky.url());
                    })
                } else return res.send(404)
            })
        })

        /**
         * move a sticky to a stack
         */
        app.post('/board/:board/stack/:stack/sticky/:sticky/move', function(req, res, next) {
            if(!req.body) {
                var to_slug = req.params.stack
                var at_pos = undefined
            } else {
                var to_slug = req.body.to || req.params.stack
                var at_pos = req.body.at
            }
            new model.Board()
                .get(req.params.board, function(err, board) {
                    if(!err && board) {
                        var to = board.stacksGet(to_slug)
                        var from = board.stacksGet(req.params.stack)
                        var sticky = null
                        if(from) {
                            sticky = from.stickiesGet(req.params.sticky)
                        }
                        if(sticky && to) {
                            from.stickiesMove(sticky, to, at_pos)
                            board.save(function(err) {
                                if(!err) {
                                    res.redirect(board.url())
                                    model.emit('stack:change', {board: board.slug, stacks: [from.slug, to.slug]})
                                } else {
                                    res.send(404)
                                }
                            })
                        } else {
                            res.send(404)
                        }
                    } else {
                        res.send(404)   
                    }
                })
        })
        
        /**
         * Getting a sticky by it's slug
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board/stack/:stack/sticky/:sticky', function(req, res, next) {
            new model.Sticky({
                parent: {
                    slug: escape(req.params.stack),
                    parent: {
                        slug: escape(req.params.board)
                    }
                }
            }).get(escape(req.params.sticky), function(err, sticky) {
                if(!err && sticky) {
                    res.render('stickies/item', {locals: {sticky: sticky}, layout: false})
                } else {
                    res.send(404)
                }
            })
        })

        /**
         * do deploy on a board.
         * @return 404 Not found, on stack empty or unknown.
         * @return 302 Redirect, with the content location pointing to the deployed stack.
         */
        app.post('/board/:board/stack/:stack/deploy', function(req, res, next) {
            res.send(501)
        })
    }) 
)
server.set('view engine', 'jade');

model.createDB(function(err, res) {
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
           // boards.on('board:save', listen_func)
        }
    });

    client.on('disconnect', function(){
        /*var listen_board = null
        if(listen_func) {
            boards.removeListener('board:save', listen_func)
        }
        listen_func = null*/
        console.log('disconnect')
    });
}));

