/**
 *
 */
var fs = require('fs')
  , jade = require('jade')
  , sys = require('sys')
  , events = require('events')
  , cradle = require('cradle')
  
/**
 * Main handler to all boards.
 * @param {Object} conf hash (name ) or db
 * @return self
 * sync
 */
var Boards = function(db, cb) {
    events.EventEmitter.call(this)
    this.db = db
    this.init(cb)
}
sys.inherits(Boards, events.EventEmitter)

Boards.client = function(conf) {
    return new(cradle.Connection)().database(conf.name)
}

Boards.prototype.init = function(cb) {
    var self = this
    this.db.exists(function(err, res) {
        if(!res) {
            var todo = 3 
            var done = function(err) {
                if(--todo == 0) {
                    cb(null, self)
                }
            }
            self.db.create(function(err) {
                self.db.save('_design/boards', {
                    all: {
                        map: function (doc) {
                            if (doc.type == 'board' && doc.name) {
                                emit({
                                    name: doc.name
                                }, doc)
                            }
                        }
                    }
                }, done)
                self.db.save('_design/stack', {
                    all: {
                        map: function (doc) {
                            if (doc.type == 'stack' && doc.name && doc.board) {
                                emit({
                                    name: doc.name,
                                    board: doc.board
                                }, doc)
                            };
                        }
                    }
                }, done)
                self.db.save('_design/stacks', {
                    all: {
                        map: function (doc) {
                            if (doc.type == 'stack' && doc.name && doc.board && doc.board.name) {
                                emit([doc.board.name, doc.name], doc)
                            };
                        }
                    }
                }, done)
                self.db.save('_design/sticky', {
                    all: {
                        map: function (doc) {
                            if (doc.type == 'sticky' && doc.slug && doc.stack) {
                                emit({
                                    slug: doc.slug,
                                    stack: doc.stack
                                }, doc)
                            };
                        }
                    }
                }, done)
                self.db.save('_design/stickies', {
                    all: {
                        map: function (doc) {
                            if (doc.type == 'sticky' && doc.slug && doc.stack && doc.stack.name && doc.stack.board && doc.stack.board.name) {
                                emit([doc.stack.board.name, doc.stack.name, doc.slug], doc)
                            };
                        }
                    }
                }, done)            })
        } else {
            cb(null, self)
        }
    })
}

/**
 * Set the boards list or a board
 * @param {Board} the board to add
 */
Boards.prototype.add = function(board) {
    board.boards = this
    return this
}

/**
 * get the boards list
 * @param {Function} called on result with err and res args
 */
Boards.prototype.all = function(cb) {
    var self = this
    this.db.view('boards/all', function(err, res) {
        if(err || res.length == 0) {
            cb(err, res)
        } else {
            cb(err, res.map(function(board) {
                var b = new Board(self.db, board)
                b.boards = self
                return b
            }))
        }
    })
}

/**
 * @todo return an array
 */
Boards.prototype.get = function(key, cb) {
    var self = this
    this.db.view('boards/all', {key: key}, function(err, res) {
        if(err || res.length == 0) {
            cb(err, res)
        } else {
            var board = new Board(self.db, res[0].value)
            board.boards = self
            cb(err, board)
        }
    })
}


/**
 * a Board.
 * @param [String] board name
 * @return self
 */
var Board = function(db, data) {
    events.EventEmitter.call(this);
    this.name = data.name
    this.id = data._id || null
    this.rev = data._rev || null
    this.db = db
}
sys.inherits(Board, events.EventEmitter)
 
Board.prototype.get = function(key, cb) {
    var self = this
    key.board = {name: this.name}
    this.db.view('stack/all',
                 {key: key},
                 function(err, res) {
        if(err || res.length == 0) {
            cb(err, res)
        } else {
            cb(err, new Stack(self.db, res[0].value))
        }
    })
}

Board.prototype.all = function(cb) {
    var self = this

    this.db.view('stacks/all',
                 {startkey: [this.name], endkey: [this.name, {}]},
                 function(err, res) {
        if(err || res.length == 0) {
            cb(err, res)
        } else {
            cb(err, res.map(function(stack) {
                return new Stack(self.db, stack)
            }))
        }
    })
}

Board.prototype.add = function(stack) {
    stack.board = this
    return this
}

/** 
 * save board data.
 * @params {Function(err)} callback on complete
 * @todo dont save stack if it already has an id
 */
Board.prototype.save = function(cb) {
    var self = this
    var data = {
        type: 'board',
        name: this.name
    } 
    if(this.id) {
        this.db.save(this.id, data, function(err, res) {
            cb(err, self)
        })
    } else {
        this.db.save(data, function(err, res) {
            if(!err) {
                self.id = res.id
            }
            cb(err, self)
        })
    }
}

Board.prototype.url = function() {
    return '/board/' + this.name
}

Board.prototype.include = function() {
    return {name: this.name}
}

/**
 * a Stack.
 * @param [String] stack name
 * @return self
 */
var Stack = function(db, data) {
    events.EventEmitter.call(this);
    this.db = db
    this.name = data.name
    this.id = data._id || null
    this.rev = data._rev || null
    this.board = typeof(data.board) == 'object' ? new  Board(db, data.board) : data.board
}
sys.inherits(Stack, events.EventEmitter)

Stack.prototype.add = function(sticky) {
    sticky.stack = this
    return this
}

Stack.prototype.save = function(cb) {
    var self = this
    var data = {
        type: 'stack',
        board: this.board.include(),
        name: this.name
    }
    if(this.id) {
        this.db.save(this.id, data, function(err, res) {
            cb(err, self)
        })
    } else {
        // get the slug
        this.db.save(data, function(err, res) {
            if(!err) {
                self.id = res.id
            }
            cb(err, self)
        })
    }
}

Stack.prototype.url = function() {
    return ['/board', this.board.name,
            'stack', this.name].join('/')
}

Stack.prototype.include = function() {
    return {
        board: this.board.include(),
        name: this.name,
    }
}
Stack.prototype.all = function(cb) {
    var self = this
    this.db.view('stickies/all',
                 {startkey: [this.board.name, this.name], endkey: [[this.board.name, this.name, {}]]},
                 function(err, res) {
        if(err || res.length == 0) {
            console.log(err, res)
            cb(err, res)
        } else {
            cb(err, res.map(function(sticky) {
                return new Sticky(self.db, sticky)
            }))
        }
    })
}

Stack.prototype.get = function(key, cb) {
    var self = this
    key.stack = this.include()
    var flat = 
    this.db.view('sticky/all',
                 {key: key},
                 function(err, res) {
        if(err || res.length == 0) {
            cb(err, res)
        } else {
            cb(err, new Sticky(self.db, res[0].value))
        }
    })
}

var Sticky = function(db, data) {
    events.EventEmitter.call(this);
    this.db = db
    this.slug = data.slug || null
    this.title = data.title || 'title'
    this.content = data.content || 'content'
    this.user = data.user || 'user'
    this.stack = typeof(data.stack) == 'object' ? new  Stack(db, data.stack) : data.stack
    this.id = data._id || null
    this.rev = data._rev || null
}
sys.inherits(Sticky, events.EventEmitter)

/**
 * @todo add a vew to the db and use collation to find possible collision in slug.
 */
Sticky.prototype.slugging = function(cb) {
    self = this
    var slug = escape(this.title.substring(0, 10))
    var base_slug = slug
    var acc = 0
    var find_it = function() {
        if(self._in_write_slugging.indexOf(self.stack.name+'/'+slug) >= 0) {
            slug = base_slug + (++acc)
            find_it()
        } else {
            self._in_write_slugging.push(self.stack.name+'/'+slug)
            self.stack.get({slug: slug}, function(err, res) {
                if(res.length > 0) {
                    delete self._in_write_slugging.indexOf(self.stack.name+'/'+slug)
                    slug = base_slug + (++acc)
                    find_it()
                } else {
                    cb(slug)
                }
            })
        }
    }
    find_it()
}

Sticky.prototype._in_write_slugging = []
Sticky.prototype.save = function(cb) {
    var self = this
      , data = {
            type: 'sticky',
            stack: this.stack.include(),
            slug: this.slug,
            title: this.title,
            content: this.content,
            user: this.user}
    if(this.id) {
        this.db.save(this.id, data, function(err, res) {
            cb(err, self)
        }) 
    } else {
        this.slugging(function(slug) {
            data.slug = slug
            self.slug = slug
            self.db.save(data, function(err, res) {
                if(!err) {
                    self.id = res.id
                }
                delete self._in_write_slugging[self._in_write_slugging.indexOf(data.stack.name+'/'+slug)]
                cb(err, self)
            }) 
        })
    }
}

Sticky.prototype.url = function() {
    return ['/board', this.stack.board.name,
            'stack', this.stack.name,
            'sticky', this.slug].join('/')
}

Sticky.prototype.remove = function(cb) {
    if(this.id && this.rev) {
        this.db.remove(this.id, this.rev, cb)
    } else {
        cb(null)
    }
}

/**  
 * Purge 'deploy' stack, backup it, save the board
 * @todo be awar about repos exist.
 * @todo test me.
Board.prototype.deploy = function(cb) {
    var self = this
    var deploy = function(err){
        var xmlDoc = libxml.parseXmlString(self.data)
        
        // historise deploy stack to disk, in /boards/name/deployed-#{jsTimestamp}.html
        var stack = xmlDoc.find("/ul[@class='board']/li[@id='deploy' and @class='stack']/ul")
        fs.writeFile(self.dir + self.name + '/deployed-' + Date.now() + '.html', stack[0].toString(), 'utf-8', function(err, data) {
            if(err) {
                cb(err)
            } else {
                self.setData(data)
                cb(err, data)
            }
            // cleanning deployed stack from doc
            stack[0].childNodes().forEach(function(sticky) {
                sticky.remove()
            })
            stack[0].node('li')

            // update our board
            self.save(xmlDoc.toString(), cb)
        })
        
    }
    if(!this.data) {
        this.load(deploy)
    } else {
        deploy(null)
    }
}
 */

exports.Board = Board
exports.Boards = Boards
exports.Stack = Stack
exports.Sticky = Sticky
