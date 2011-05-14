/**
 *
*/
// Required system libraries
var http    = require('http')
  , jade    = require('jade')
  , express = require('express')
  , socketIO = require("socket.io-connect").socketIO
  , form    = require('connect-form')
  , fs      = require('fs')
  , sys     = require('sys')
  , im      = require('imagemagick') 
  , FileStore = require('./models/file-session')
  , Model = require('./models/board')
  , EventEmitter = require('events').EventEmitter


var config = require('./config')

var model = new Model({name: config.db.name})
  , event = new EventEmitter()


var server = express.createServer(
    socketIO( function () { return server }, boardSocket)
  , express.static(__dirname + '/public')
  , express.logger()
  , express.cookieParser()
  , express.session({secret: 'rhododendron', store: new FileStore({storeFilename: '/tmp/boardSessionStore.json'})})
  , express.bodyParser()
  , form({keepExtensions: true})
  , express.methodOverride()
  , express.router(function(app) {

       /**
        * Home
        */
        app.get('/', function(req, res, next) {
            if(req.session.user) {
                new model.Board()
                    .knownBy(req.session.user.nick, function(err, boards) {
                        res.render('user/item', {locals: {boards: boards, user: new model.User(req.session.user)}})
                    })
            } else {
                res.render('home', {locals: {user: req.session.user}})
            }
        })

        /**
         * get the user info or the form to register if not loged.
         */
        app.get('/user', function(req, res, next) {
            if(req.session.user) {
                new model.Board()
                    .knownBy(req.session.user.nick, function(err, boards) {
                        res.render('user/item', {locals: {boards: boards, user: new model.User(req.session.user)}})
                    })
            } else res.render('user/form', {user: null})
        })

        /**
         * register a new user
         * @todo uniq login ?
         * @todo as another app.
         */
        app.post('/user', function(req, res, next) {
            req.form.complete(function(err, fields, files) {
                if(fields.nick && fields.password && fields.confirm && fields.password == fields.confirm) {
                        var user = new model.User({
                            nick: fields.nick
                          , password: fields.password})
                        user.save(function(ret) {
                            req.session.user = user
                            res.redirect('/user')
                            if(files.avatar) {
                                im.resize({
                                    srcPath: files.avatar.path
                                  , format: 'png'
                                  , width:  64
                                  , dstPath: __dirname + '/public/avatar/'+ user.nick +'.png'
                                    }, function(err, stdout, stderr) {})
                                }
                            })
                } else res.render('user/form')
            })
        })

        app.get('/login', function(req, res, next) {
            res.render('user/login', {locals: {user : null}, layout: !req.isXMLHttpRequest})
        })

        app.post('/login', function(req, res, next) {
            if(req.body.nick) {
                new model.User()
                    .get(req.body.nick, function(err, user) {
                        if(!err && user && user.password == req.body.password) {
                            req.session.user = user
                            res.redirect('/')
                        } else res.render('user/login', {status: 401, locals: {user: null}})
                    })
            } else res.render('user/login', {status: 401, locals: {user: null}})
        })

        app.get('/logout', function(req, res, next) {
            req.session.destroy()
            res.redirect('/')
        })

        /**
         * Get form to create a board
         */
        app.get('/board', function(req, res, next) {
            if(req.session.user) {
                res.render('boards/form')
            } else throw new Unauthorized
        })

        /**
         * New board, empty (as in no stack)
         * @params slug {String} the board slug
         * @return 302 Redirect on created, content-location headers point to the new board.
         */
        app.post('/board', function(req, res, next) {
            if(req.session.user) {
                var user = new model.User(req.session.user)
                new model.Board({name: req.param('name')})
                    .authorize(user, 3)
                    .save(function(err, board) {
                        event.emit('board:new', board)
                        res.redirect(board.url())
                    })
            } else {throw new Unauthorized}
        })

        /**
         * Getting a board by it's slug
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board', function(req, res, next) {
            if(req.session.user) {
                var user = new model.User(req.session.user)
                user.can(new model.Board({slug: escape(req.params.board)}), 1)
                    .accept(function(level) {
                        new model.Board()
                            .get(escape(req.params.board), function(err, board) {
                            if(!err && board) {
                                res.render('boards/item', {locals: {board: board, user: user, rights: level}, layout: 'boards/layout'})
                            } else res.send(404)
                        })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * Getting the board users and auth management.
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board/users', function(req, res, next) {
            if(req.session.user) {
                var user = new model.User(req.session.user)
                user.can(new model.Board({slug: escape(req.params.board)}), 1)
                    .accept(function(rights) {
                        new model.Board().get(escape(req.params.board), function(err, board) {
                            if(!err && board) {
                                res.render('boards/users/edit', {locals: {board: board, rights: rights, user: user}})
                            } else res.send(404)
                        })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * Change rights on the board.
         * @return 302 Redirect on done.
         * @return 404 Not Found if it doesn't exist.
         */
        app.post('/board/:board/users', function(req, res, next) {
            if(req.session.user) {
                var user = new model.User(req.session.user)
                user.can(new model.Board({slug: escape(req.params.board)}), 3)
                    .accept(function() {
                        if(user.nick == req.body.nick) { // avoid removing admin on herself
                            return res.send(302)
                        }
                        new model.Board().get(escape(req.params.board), function(err, board) {
                            board.authorize({nick: req.body.nick}, parseInt(req.body.level))
                                .save(function() { res.redirect(board.url() + '/users') })
                             })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * Get form to create a Stack
         * @return 404 Not found, board doesn't exist.
         */
        app.get('/board/:board/stack', function(req, res, next) {
            if(req.session.user) {
                var user = new model.User(req.session.user)
                user.can(new model.Board({slug: escape(req.params.board)}), 2)
                    .accept(function(rights) {
                        new model.Board()
                            .get(escape(req.params.board), function(err, board) {
                                if(err || !board) res.send(404)
                                else {
                                    res.render('stacks/form', {locals: {board: board, user: user, rights: rights}})
                                }
                            })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * Add stack to a board.
         * @return 302 Redirect, on created, content-location headers point to the new stack.
         * @return 404 Not found, board doesn't exist.
         */
        app.post('/board/:board/stack', function(req, res, next) {
            if(req.session.user) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 2)
                    .accept(function() {
                        new model.Board()
                            .get(escape(req.params.board), function(err, board) {
                                if(err || !board) res.send(404)
                                else {
                                    board.stacksAdd(new model.Stack({name: req.body.name}))
                                    board.save(function(err, stack) {
                                        event.emit('stack:new', stack)
                                        res.redirect(stack.url())
                                    })
                                }
                            })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * Getting a stack by it's slug
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board/stack/:stack', function(req, res, next) {
            if(req.session.user) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 1)
                    .accept(function(rights) {
                        new model.Stack({parent:{slug: escape(req.params.board)}})
                            .get(escape(req.params.stack), function(err, stack) {
                                if(!err && stack) {
                                    res.render('stacks/item.jade', {locals: {stack: stack, rights: rights}})
                                } else res.send(404)
                             })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * Get form to create a Sticky
         */
        app.get('/board/:board/stack/:stack/sticky', function(req, res, next) {
            if(req.session.user) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 2)
                    .accept(function(rights) {
                        new model.Stack({parent: {slug: escape(req.params.board)}})
                            .get(escape(req.params.stack), function(err, stack) {
                                if(!err && stack) {
                                    res.render('stickies/form', {locals: {stack: stack, rights: rights}, layout: req.isXMLHttpRequest})
                                } else res.send(404)
                            })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * Add sticky to a stack.
         * @return 302 Redirect, on created, content-location headers point to the new sticky.
         * @return 404 Not found, board or stack doesn't exist.
         */
        app.post('/board/:board/stack/:stack/sticky', function(req, res, next) {

            if(req.session.user && req.body.title && req.body.title.length > 0) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 2)
                    .accept(function() {
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
                                        event.emit('sticky:new', sticky, board.rev)
                                        res.redirect(sticky.url())
                                    })
                                } else return res.send(404)
                            })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * update a sticky.
         * @return 302 Redirect, on done, content-location headers point to the new sticky.
         * @return 404 Not found, sticky doesn't exist.
         * @return 500 On fail to save.
         */
        app.post('/board/:board/stack/:stack/sticky/:sticky', function(req, res, next) {
            if(req.session.user && req.body.title && req.body.title.length > 0) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 2)
                    .accept(function() {
                        new model.Board()
                            .get(escape(req.params.board), function(err, board) {
                            if(!err && board) {
                                var stack = board.stacksGet(escape(req.params.stack))
                                if(!stack) return res.send(404)
                                var sticky = stack.stickiesGet(escape(req.params.sticky))
                                if(!sticky)return res.send(404)
                                sticky.title = req.body.title
                                sticky.content = req.body.content
                                board.save(function(err, board) {
                                    if(err) return res.send(500)
                                    event.emit('sticky:update', sticky, board.rev)
                                    res.redirect(sticky.url())
                                })
                            } else res.send(404)
                        })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * add a user to a sticky .
         * @return 302 Redirect, on done, content-location headers point to the new sticky.
         * @return 404 Not found, sticky doesn't exist.
         * @return 500 On fail to save.
         * @todo validate params.
         */
        app.post('/board/:board/stack/:stack/sticky/:sticky/user', function(req, res, next) {
            if(req.session.user) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 2)
                    .accept(function() {
                        new model.Board()
                            .get(escape(req.params.board), function(err, board) {
                            if(!err && board) {
                                var stack = board.stacksGet(escape(req.params.stack))
                                if(!stack) return res.send(404)
                                var sticky = stack.stickiesGet(escape(req.params.sticky))
                                if(!sticky)return res.send(404)
                                //fixme hack to map as in board.users.allow for gallery tpl
                                sticky.user[req.body.user] = 0
                                board.save(function(err, board) {
                                    if(err) return res.send(500)
                                    event.emit('sticky:user:add', sticky, req.body.user, board.rev)
                                    res.redirect(sticky.url())
                                })
                            } else res.send(404)
                        })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * move a sticky to a stack
         */
        app.post('/board/:board/stack/:stack/sticky/:sticky/move', function(req, res, next) {
            if(req.session.user) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 2)
                    .accept(function() {
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
                                                event.emit('sticky:move', sticky, from, at_pos, board.rev)
                                                res.redirect(board.url())
                                            } else res.send(404)
                                        })
                                    } else res.send(404)
                                } else res.send(404)
                            })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * remove auser from the sticky.
         */
        app.del('/board/:board/stack/:stack/sticky/:sticky/user/:user', function(req, res, next) {
            if(req.session.user) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 2)
                    .accept(function(rights) {
                        new model.Board()
                            .get(escape(req.params.board), function(err, board) {
                                if(err || !board) return res.send(404)
                                var stack = board.stacksGet(escape(req.params.stack))
                                if(!stack) return res.send(404)
                                var sticky = stack.stickiesGet(escape(req.params.sticky))
                                if(!sticky) return res.send(404)
                                if(!sticky.user[escape(req.params.user)] && sticky.user[escape(req.params.user)] != 0) {
                                    return res.send(404)
                                }
                                delete sticky.user[escape(req.params.user)]
                                board.save(function(err) {
                                    res.send(204)
                                    event.emit('sticky:user:remove', sticky, escape(req.params.user), board.rev)
                                })
                            })
                     })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })
        
        /**
         * Getting a sticky by it's slug
         * @return 404 Not Found if it doesn't exist
         */
        app.get('/board/:board/stack/:stack/sticky/:sticky', function(req, res, next) {
            if(req.session.user) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 1)
                    .accept(function(rights) {
                        new model.Sticky({
                            parent: {
                                slug: escape(req.params.stack),
                                parent: {
                                    slug: escape(req.params.board)
                                }
                            }
                        }).get(escape(req.params.sticky), function(err, sticky) {
                            if(!err && sticky) {
                                res.render('stickies/item', {locals: {sticky: sticky}, layout: false, rights: rights})
                            } else res.send(404)
                        })
                    })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * Getting a sticky by it's slug
         * @return 404 Not Found if it doesn't exist
         */
        app.del('/board/:board/stack/:stack/sticky/:sticky', function(req, res, next) {
            if(req.session.user) {
                new model.User(req.session.user)
                    .can(new model.Board({slug: escape(req.params.board)}), 2)
                    .accept(function(rights) {
                        new model.Board()
                            .get(escape(req.params.board), function(err, board) {
                                if(err || !board) return res.send(404)
                                var stack = board.stacksGet(escape(req.params.stack))
                                if(!stack) return res.send(404)
                                var sticky = stack.stickiesGet(escape(req.params.sticky))
                                if(!sticky) return res.send(404)
                                var data  = sticky.asData()
                                stack.stickiesRemove(sticky)
                                board.save(function(err) {
                                    res.send(204)
                                    event.emit('sticky:remove', data, board.rev)
                                })
                            })
                     })
                    .refuse(function() { throw new Unauthorized })
            } else throw new Unauthorized
        })

        /**
         * do deploy on a board.
         * @return 404 Not found, on stack empty or unknown.
         * @return 302 Redirect, with the content location pointing to the deployed stack.
         */
        app.post('/board/:board/stack/:stack/deploy', function(req, res, next) {
            res.send(501)
        })
        
        app.get('*', function(req, res) {
            res.send('Not Found', 404)
        })
    })
)

server.set('view engine', 'jade')

function Unauthorized(msg) {
    this.name = "Unauthorized"
    msg = 'prout'
    console.log('me')
    Error.call(this, msg)
    //Error.captureStackTrace(this, arguments.callee)
    console.log('it')
}

sys.inherits(Unauthorized, Error)

server.error(function(err, req, res, next) {
    if (err instanceof Unauthorized) {
        res.render('401', {status: 401, locals: {user: null}})
    } else {
        next(err)
    }
});
server.error(function(err, req, res) {
    console.log(err.stack)
    res.render('500', {
        status: 500,
        locals: {
            error: err,
            user: req.session.user || null
        } 
    });
});
model.createDB(function(err) {
    server.listen(config.server.port, config.server.host)
    console.log('up and ready on http://'+config.server.host+':'+config.server.port)
})


function boardSocket(client, req, res) {

    var listen_board = null,
        listen_func = null
    
    var stickyNew = function(sticky, rev) {
        if(sticky.parent.parent.slug == listen_board) {
            client.send({event: 'sticky:new', sticky: sticky.asData(), rev: rev})
        }
    }
    var stickyUpdate = function(sticky, rev) {
        if(sticky.parent.parent.slug == listen_board) {
            client.send({event: 'sticky:update', sticky: sticky.asData(), rev: rev})
        }
    }

    var stickyMove = function(sticky, from, at, rev) {
        if(sticky.parent.parent.slug == listen_board) {
            client.send({event: 'sticky:move', sticky: sticky.asData(), from: from.asData(), at: at, rev: rev})
        }
    }

    var stickyRemove = function(sticky, rev) {
        if(sticky.parent.parent.slug == listen_board) {
            client.send({event: 'sticky:remove', sticky: sticky, rev: rev})
        }
    }

    var stickyUserAdd = function(sticky, user, rev) {
        if(sticky.parent.parent.slug == listen_board) {
            client.send({event: 'sticky:user:add', sticky: sticky.asData(), user: user, rev: rev})
        }
    }

    var stickyUserRemove = function(sticky, user, rev) {
        if(sticky.parent.parent.slug == listen_board) {
            client.send({event: 'sticky:user:remove', sticky: sticky.asData(), user: user, rev: rev})
        }
    }

    client.on('message', function(message){
        // client can change the listenned board.
        if(message.board && listen_board != message.board) {
            listen_board = message.board
            if(listen_board) {
                event.removeListener('sticky:new', stickyNew)
                event.removeListener('sticky:update', stickyUpdate)
                event.removeListener('sticky:move', stickyMove)
                event.removeListener('sticky:remove', stickyRemove)
                event.removeListener('sticky:user:add', stickyUserAdd)
                event.removeListener('sticky:user:remove', stickyUserRemove)
            }
            listen_board = message.board
            
            event.on('sticky:new', stickyNew)
            event.on('sticky:update', stickyUpdate)
            event.on('sticky:move', stickyMove)
            event.on('sticky:remove', stickyRemove)
            event.on('sticky:user:add', stickyUserAdd)
            event.on('sticky:user:remove', stickyUserRemove)
        }
    })

    client.on('disconnect', function(){
        var listen_board = null
        event.removeListener('sticky:new', stickyNew)
        event.removeListener('sticky:update', stickyUpdate)
        event.removeListener('sticky:move', stickyMove)
        event.removeListener('sticky:remove', stickyRemove)
        event.removeListener('sticky:user:add', stickyUserAdd)
        event.removeListener('sticky:user:remove', stickyUserRemove)
    })
}
