/**
 *
 */
var fs = require('fs')
  , jade = require('jade')
  , sys = require('sys')
  , libxml = require('libxmljs')
  , events = require('events')
  , CouchClient = require('couch-client')
  , cradle = require('cradle')
  
var tpls = __dirname + '/jade'

var db = new(cradle.Connection)().database('board')
if(!db.exists()){
    db.create()

    db.save('_design/boards', {
        all: {
            map: function (doc) {
                if (doc.name) emit(doc.name, null);
            }
        }
    })
}

var BoardsFactory = function(cb) {
    events.EventEmitter.call(this);
    db.get
    var self = this
    this.boards = {}
    var todo = 0
    fs.readdir(this.dir, function(err, files) {
        todo = files.length
        files.forEach(function(file) {
            fs.stat(self.dir + '/' + file, function(err, stat) {
                if(!err && stat.isDirectory()) {
                    var board = new Board(file)
                    board.dir = self.dir + '/' 
                    board.load(function(err) {
                        if(!err) {
                            self.register(board)
                        } else {
                            console.log(err)
                        }
                        todo--
                        if(todo < 1) {
                            cb(null)
                        }
                    })
                } else {
                    todo--
                    if(todo < 1) {
                        cb(null)
                    }
                }
            })
        })
        if(err || todo < 1) {
            console.log('dir  empty or err', todo)
            cb(null)
        }
    })
}
sys.inherits(BoardsFactory,events.EventEmitter)

BoardsFactory.prototype.register = function(board) {
    var self = this
    board.dir = self.dir + '/'
    board.on("save", function(board) {
        console.log('factory received a save from' + board.name)
        self.emit("board:save", board)
    })
    this.boards[board.name] = board
    return board
}

BoardsFactory.prototype.add = function(name) {
    return this.boards[name] || this.register(new Board(name))
}

BoardsFactory.prototype.all = function(cb) {
    db.get('boards/all')
}

BoardsFactory.prototype.find = function(name, cb) {
    db.get('boards/all', {key: name}, function(err, res) {
        if(err) {
            cb(err)
        } else {
            var ret = res.forEach(res)
            cberr.row(res)
        }
    })
}

/**
 * Persistence for Board.
 * You should use BoardsFactory in place of using new Board.
 * @todo be awar about repos exist.
 * @todo security need some check on realpath
 */
var Board = function(name) {
    events.EventEmitter.call(this);
    this.name = name
    this.data = null
}
sys.inherits(Board, events.EventEmitter)

/**
 * load persisted data.
 * @params {Function(err, data)} callback on complete
 */
Board.prototype.load = function(cb) {
    var self = this
    fs.readFile(this.dir + this.name + '/index.html', 'utf-8', function(err, data) {
        if(err) {
            cb(err)
        } else {
            self.setData(data)
            cb(err, data)
        }
    })
}

Board.prototype.setData = function(data) {
    this.data = data
}

/**
 * save board data.
 * @params {Function(err)} callback on complete
 */
Board.prototype.save = function(html, cb) {
    var self = this
    fs.writeFile( this.dir + this.name + '/index.html', html, 'utf-8', function(err) {
        if(err) {
            cb(err)
        } else {
            console.log(html)
            self.setData(html)
            self.emit("save", self)
            cb(err, html)
        }
    })
}

/**
 * write a new initialized board.
 * @params {Function(err, data)} callback on complete
 */
Board.prototype.create = function(cb) {
    var self = this
    fs.mkdir(this.dir + this.name, '766', function(err) {
        if(err) {
            cb(err)
        } else {
            // compile an empty board
            jade.renderFile( tpls + '/board_empty.jade', function(err, html) {
                if(err) {
                    cb(err)
                } else {
                    // write the empty board in the new repos
                    self.save(html, function(err) {
                        cb(err, html)
                    })
                }
            })
        }
    })
}

/**  
 * Purge 'deploy' stack, backup it, save the board
 * @todo be awar about repos exist.
 * @todo test me.
 */
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

exports.Board = Board

exports.BoardsFactory = BoardsFactory
