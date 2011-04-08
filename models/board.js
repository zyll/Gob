/**
 *
 */
var cradle = require('cradle')
  , Futures = require('futures')

/**
 * Give slug powa to an object. this one have now a sluggyfy
 * method in order to generate an appropriate slug in the slug property.
 * This slug is reserved while the object is not persisted, flush the cache should be done in the object itself.
 */
function Slugify(obj, prop) {
    obj.prototype._in_write_slugging = []
    obj.prototype.slugging = function(cb) {
        var self = this
        //var slug = escape(this[prop].substring(0, 10))
          , slug = escape(this[prop].substring(0, 10)).replace(/\%20/g, '-')
          , base_slug = slug
          , acc = 0
          , parent_slug = this.parent ? this.parent.slug : self.model.db.name
          , find_it = function() {
                if(self._in_write_slugging.indexOf(parent_slug + '/' + slug) >= 0) {
                    slug = base_slug + '-' + (++acc)
                    find_it()
                } else {
                    self._in_write_slugging.push(parent_slug + '/' + slug)
                    self.get(slug, function(err, res) {
                        if(res) {
                            delete self._in_write_slugging.indexOf((parent_slug) + '/' + slug)
                            slug = base_slug + '-' + (++acc)
                            find_it()
                        } else {
                            cb(slug)
                        }
                    })
                }
            }
        find_it()
    }
}
  
/**
 * Main handler.
 * @param {Object} conf hash (name) or db
 * @return self
 */
var Model = function(conf) {
    this.db = new(cradle.Connection)().database(conf.name)
    var self = this
    this.Board = function(data) {return new Model.Board(self, data)}
    this.Stack = function(data) {return new Model.Stack(self, data)}
    this.Sticky = function(data) {return new Model.Sticky(self, data)}
}

Model.designs = [
    {name: '_design/boards',
     views: {
        by_slug: {
            map: function (doc) {
                if (doc.type == 'board') {
                    emit(doc.slug, doc)
                }
            }
        },
        ligth: {
            map: function (doc) {
                if (doc.type == 'board') {
                    emit(doc.slug, {slug: doc.slug, name: doc.name})
                }
            }
        }
    }},
    {name: '_design/stacks',
     views: {
        by_slug: {
            map: function (doc) {
                if (doc.type == 'board') {
                    doc.stacks.forEach(function(stack) {
                        emit([doc.slug, stack.slug], stack)
                    })
                }
            }
        }
    }},
    {name: '_design/stickies',
     views: {
        by_slug: {
            map: function (doc) {
                if (doc.type == 'board') {
                    doc.stacks.forEach(function(stack) {
                        stack.stickies.forEach(function(sticky) {
                            emit([doc.slug, stack.slug, sticky.slug], sticky)
                        })
                    })
                }
            }
        }
    }}
]

Model.prototype.migrate = function(next) {
    // removing old design should be great.
    var self = this
    var saveDesigns = new Futures.join()
    saveDesigns.add(Model.designs.map(function(design) {
        var done = Futures.future()
        self.db.save(design.name, design.views, done.deliver)
        return done
    }))
    saveDesigns.when(next)
}

/**
 * Make sur that db are present.
 */
Model.prototype.createDB = function(cb) {
    var self = this
    this.db.exists(function(err, res) {
        self.db.create(function(err) {
           if(!res) {
                self.migrate(cb)
            } else {
                cb(null, self)
            }
        })
    })
}

/**
 * Remove the db (mainly for test cleanup urpose).
 */
Model.prototype.removeDB = function(cb) {
    this.db.destroy(cb)
}

/**
 * Give an object (obj) the ability to load a collection in a properties (prop)).
 * this collection can be pur json or even Object (kind).
 * if not object data will be encapse as the mentioned object (kind).
 */
function Compose(obj, prop, kind) {
    obj.prototype[prop+'Set'] = function(data) {
        var self = this
        if(data[prop]) {
            self[prop] = data[prop].map(function(item) {
                if(item instanceof Model[kind]) {
                    return item
                } else {
                    item.parent = self // avoid duplicate board instance
                    return new self.model[kind](item)
                }
            })
        } else {
            self[prop] = []
        }
    }
    obj.prototype[prop + 'Add'] = function(obj) {
        obj.parent = this
        this[prop].push(obj)
    }
}

/**
 * a Board.
 * @param [String] board name
 * @return self
 */
Model.Board = function(model, data) {
    this.model = model
    data  = data || {}
    var self = this
    this.name = data.name
    this.slug = data.slug
    this.id = data._id
    this.rev = data._rev
    this.stacksSet(data)
    /*
    if(data.stacks) {
        this.stacks = data.stacks.map(function(item) {
            if(item instanceof Model.Stack) {
                return item // mhhhh, must check that on some tricky case.
            } else {
                item.board = self // avoid duplicate board instance
                return new model.Stack(item)
            }
        })
    } else {
        this.stacks = []
    }*/
}
Slugify(Model.Board, 'name')
Compose(Model.Board, 'stacks', 'Stack')
/** 
 * save board data.
 * @params {Function(err)} callback on complete
 * @todo dont save stack if it already has an id
 */
Model.Board.prototype.save = function(cb) {
    var self = this
    var data = {
        type: 'board',
        name: this.name,
        slug: this.slug
    } 
    if(this.id) {
        this.model.db.save(this.id, data, function(err, res) {
            cb(err, self)
        })
    } else {
        this.slugging(function slugginBack(slug) {
            data.slug = slug
            self.slug = slug
            self.model.db.save(data, function(err, res) {
                if(!err) {
                    self.id = res.id
                    self.rev = res._rev
                }
                delete self._in_write_slugging[self._in_write_slugging.indexOf(slug)]
                cb(err, self)
            })
        })
    }
}

Model.Board.prototype.get = function(slug, cb) {
    var self = this
    this.model.db.view('boards/by_slug',
                 {key: slug},
                 function(err, res) {
                     console.log('======------------>')
                     console.log(res)
                     console.log('<-----=============')
                     if(err || res.length == 0) {
                         cb(err, null)
                     } else {
                         cb(err, new self.model.Board(res[0].value))
                     }
                 })
}

/**
 * get a ligth boards list.
 * @param {Function} called on result with err and res args
 */
Model.Board.prototype.all = function(cb) {
    var self = this
    this.model.db.view('boards/ligth', function(err, res) {
        if(err || res.length == 0) {
            cb(err, res)
        } else {
            cb(err, res.map(function(board) {
                return new self.model.Board(self.model.db, board)
            }))
        }
    })
}

/**
 * a Stack.
 * @param [String] stack name
 * @return self
 */
Model.Stack = function(model, data) {
    data = data || {}
    this.model = model
    this.name = data.name
    this.slug = data.slug
    this.id = data._id
    this.rev = data._rev
    this.parent = data.parent
    this.stickiesSet(data)
}
Slugify(Model.Stack, 'name', 'board')
Compose(Model.Stack, 'stickies', 'Sticky')

Model.Stack.prototype.all = function(cb) {
    var self = this
    this.model.db.view('stacks/by_slug',
                       {startkey: [this.parent.slug], endkey: [this.parent.slug, {}]},
                       function(err, res) {
                           if(err || res.length == 0) {
                               cb(err, res)
                           } else {
                               cb(err, res.map(function(stack) {
                                   return new self.model.Stack(stack)
                               }))
                           }
    })
}

Model.Stack.prototype.get = function(key, cb) {
    var self = this
    this.model.db.view('stacks/by_slug',
                 {key: [this.parent.slug, key]},
                 function(err, res) {
        if(err || res.length == 0) {
            cb(err, null)
        } else {
            cb(err, new self.model.Stack(res[0].value))
        }
    })
}

Model.Sticky = function(model, data) {
    this.model = model
    this.slug = data.slug || null
    this.title = data.title || 'title'
    this.content = data.content || 'content'
    this.user = data.user || 'user'
    this.id = data._id || null
    this.rev = data._rev || null
    this.parent = data.parent || null
}
Slugify(Model.Sticky, 'title', 'stack')

Model.Sticky.prototype.all = function(cb) {
    var self = this
    this.model.db.view('stickies/by_slug',
                       {startkey: [this.parent.parent.slug, this.parent.slug], endkey: [this.parent.parent.slug, this.parent.slug, {}]},
                       function(err, res) {
                           if(err || res.length == 0) {
                               cb(err, res)
                           } else {
                               cb(err, res.map(function(sticky) {
                                   return new self.model.Sticky(sticky)
                               }))
                           }
    })
}

Model.Sticky.prototype.get = function(key, cb) {
    var self = this
    this.model.db.view('stickies/by_slug',
                 {key: [this.parent.parent.slug, this.parent.slug, key]},
                 function(err, res) {
        if(err || res.length == 0) {
            cb(err, null)
        } else {
            cb(err, new self.model.Sticky(res[0].value))
        }
    })
}




var Stack = function() {}
Stack.prototype.add = function(sticky) {
    sticky.stack = this
    return this
}

Stack.prototype.save = function(cb) {
    var self = this
    var data = {
        type: 'stack',
        board: this.board.include(),
        name: this.name,
        slug: this.slug
    }
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
                    self.id = res._id
                    self.rev = res._res
                }
                delete self._in_write_slugging[self._in_write_slugging.indexOf(data.board.slug + '/' + slug)]
                cb(err, self)
            })
        })
    }
}

Stack.prototype.url = function() {
    return ['/board', this.board.slug,
            'stack', this.slug].join('/')
}

Stack.prototype.include = function() {
    return {
        board: this.board.include(),
        slug: this.slug,
    }
}




var Sticky = function() {}

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
                delete self._in_write_slugging[self._in_write_slugging.indexOf(data.stack.slug+'/'+slug)]
                cb(err, self)
            }) 
        })
    }
}

Sticky.prototype.url = function() {
    return ['/board', this.stack.board.slug,
            'stack', this.stack.slug,
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
 * -------------- old stuff
 */
var Board = function(){}

Board.prototype.all = function(cb) {
    var self = this

    this.db.view('stacks/all',
                 {startkey: [this.slug], endkey: [this.slug, {}]},
                 function(err, res) {
        if(err || res.length == 0) {
            cb(err, res)
        } else {
            cb(err, res.map(function(stack) {
                var s = new Stack(self.db, stack)
                self.add(s)
                return s
            }))
        }
    })
}

Board.prototype.add = function(stack) {
    stack.board = this
    return this
}



Board.prototype.url = function() {
    return '/board/' + this.slug
}

Board.prototype.include = function() {
    return {slug: this.slug}
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

module.exports = Model
