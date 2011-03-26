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
var Boards = function(conf, cb) {
    events.EventEmitter.call(this);
    this.conf = conf
    this.db = new(cradle.Connection)().database(this.conf.name)
    var self = this
    this.db.exists(function(err, res) {
        if(!res) {
            self.db.create(function(err) {
                self.db.save('_design/boards', {
                    all: {
                        map: function (doc) {
                            if (doc.type == 'board' && doc.name) emit(doc.name, doc);
                        }
                    }
                }, function() {cb(null, self)})
            })
        } else {
            cb(null, self)
        }
    })
}
sys.inherits(Boards, events.EventEmitter)

/**
 * Set the boards list or a board
 * @param {Board} the board to add
 */
Boards.prototype.add = function(board) {
    board.boards = this
    return this
}

Boards.prototype.skeleton = function() {
    var self = this
    return {
        type: 'boards',
        name: this.conf.name,
    boards: this.boards.map(function(board) {return board.skeleton()})
    }
}

/**
 * get the boards list
 * @param {Function} called on result with err and res args
 */
Boards.prototype.all = function(cb) {
    this.db.view('boards/all', function(err, res) {
        if(res.length == 0) {
            return cb(err, res)
        }
        var ret = []
        res.forEach(function(board) {
            ret.push(new Board(board))
        })
        cb(err, ret)
    })
}

Boards.prototype.get = function(name, cb) {
    var self = this
    this.db.view('boards/all', {key: name}, function(err, res) {
        var b = new Board(res[0].value)
        b.boards = self
        cb(err, b)
    })
}


/**
 * a Board.
 * @param [String] board name
 * @return self
 */
var Board = function(opt) {
    events.EventEmitter.call(this);
    var self = this
    if(typeof(opt) == 'object') {
        this.name = opt.name
        this.stacks = opt.stacks.map(function(s) {
            return new Stack(s)
        })
    } else {
        this.name = opt 
        this.stacks = []
        this.boards = null
        var l = ['todo', 'progress', 'deploy']
        l.forEach(function(name) {
            var s = new Stack(name)
            s.board = self
            self.stacks.push(s)
        })
        this.boards = null
    }
}
sys.inherits(Board, events.EventEmitter)
 
Board.prototype.skeleton = function() {
    var self = this
    return {
        type: 'board',
        name: this.name,
        id: this.id,
        stacks: this.stacks.map(function(stack) {return stack.skeleton()})
    }
}

/** 
 * save board data.
 * @params {Function(err)} callback on complete
 * @todo dont save stack if it already has an id
 */
Board.prototype.save = function(cb) {
    var self = this
    var ok_stack = 0
    this.stacks.forEach(function(s) {
        // be sure we have an id on stacks
        s.save(function(err, s) {
            ok_stack++
            if(ok_stack == self.stacks.length) {
                if(self.id) {
                    self.boards.db.save(self.id, self.skeleton(), function(err, res) {
                        cb(err, self)
                    })
                } else {
                    self.boards.db.save(self.skeleton(), function(err, res) {
                        if(!err) {
                            self.id = res.id
                        }
                        cb(err, self)
                    })
                }
            }
        })
    })
}
Board.prototype.get = function(cb) {
    this.boards.get(this.name, cb)
}

/**
 * a Stack.
 * @param [String] stack name
 * @return self
 */
var Stack = function(data) {
    events.EventEmitter.call(this);
    if(typeof(data) == 'object') {
        this.id = data.id
        this.name = data.name
        this.stickies =  data.stickies ? data.stickies.map(function(s) {return new Sticky(s)}) : []
    } else {
        this.name = data
        this.stickies = []
    }
}
sys.inherits(Stack, events.EventEmitter)

Stack.prototype.add = function(sticky) {
    sticky.stack = this
    this.stickies.push(sticky)
    return this
}

Stack.prototype.remove = function(sticky, cb) {
    self = this;
    var pos = this.stickies.indexOf(sticky)
    if(pos > -1) {
        console.log('removed')
        this.stickies.splice(pos, 1)
        this.board.save(function(err) {cb(err, self)})
    } else {
        cb(null, self)
    }


}

Stack.prototype.skeleton = function() {
    var self = this
    return {
        type: 'stack',
        name: this.name,
        id: this.id,
        stickies: this.stickies.map(function(sticky) {return sticky.skeleton()})
    }
}

Stack.prototype.save = function(cb) {
    var self = this
    var save = function() {
        var data = {
            type: 'stack',
            name: self.name,
            stickies: self.stickies.map(function(s) {return s.id})
        },
            done = function(err, res) {
                if(!err) {
                    self.id = res.id
                }
                cb(err, self)
            }
        if(self.id) {
            self.board.boards.db.save(self.id, data, done)
        } else {
            self.board.boards.db.save(data, done)
        }
    }
    if(this.stickies.length > 0) {
        var ok_stickies = 0
        this.stickies.forEach(function(s) {
            // be sure we have an id on stacks
            s.save(function(err, s) {
                ok_stickies++
                if(ok_stickies == self.stickies.length) {
                    save()
                }
            })
        })
    } else {
        save()
    }

}

var Sticky = function(data) {
    events.EventEmitter.call(this);
    this.title = data.title || 'title'
    this.content = data.content || 'content'
    this.user = data.user || 'user'
    this.stack = null
}
sys.inherits(Sticky, events.EventEmitter)

Sticky.prototype.skeleton = function() {
    var self = this
    return {
        type: 'sticky',
        title: this.title,
        id: this.id
    }
}


Sticky.prototype.save = function(cb) {
    var self = this,
        data = {
        type: 'ticket',
        name: self.title,
        name: self.content,
        name: self.content,
    },
        done = function(err, res) {
        if(!err) {
            self.id = res.id
        }
        cb(err, self)
    }
    if(this.id) {
        this.stack.board.boards.db.save(this.id, data, done) 
    } else {
        this.stack.board.boards.db.save(data, done) 
    }
}/**  
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
