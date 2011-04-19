/**
 *
 */
var cradle = require('cradle')
  , Futures = require('futures')
  , sys = require('sys')

/**
 * Give slug powa to an object. this one have now a sluggyfy
 * method in order to generate an appropriate slug in the slug property.
 * This slug is reserved while the object is not persisted, flush the cache should be done in the object itself.
 */
function Slugify(obj, prop) {

    obj.prototype.bookSlug = function(ns, slug) {
        if(!this.model.slugBooker[ns]) {
            this.model.slugBooker[ns] = []
        }
        this.model.slugBooker[ns].push(slug)
    }

    obj.prototype.freeSlug = function(ns, slug) {
        if(this.model.slugBooker[ns] && this.model.slugBooker[ns][slug]) {
            delete this.model.slugBooker[ns][slug]
            if(this.model.slugBooker[ns].length == 0) {
                delete this.model.slugBooker[ns]
            }
        }
    }

    obj.prototype.isBookSlug = function(ns, slug) {
        return this.model.slugBooker[ns] && this.model.slugBooker[ns].indexOf(slug) >= 0
    }

    obj.prototype.slugging = function(ns, cb) {
        var self = this
          , slug = escape(this[prop].substring(0, 10)).replace(/\%20/g, '-')
          , base_slug = slug
          , acc = 0
          , find_it = function() {
                if(self.isBookSlug(ns, slug)) {
                    slug = base_slug + '-' + (++acc)
                    find_it()
                } else {
                    self.bookSlug(ns, slug)
                    self.get(slug, function(err, res) {
                        if(res) {
                            self.freeSlug(ns, slug)
                            slug = base_slug + '-' + (++acc)
                            find_it()
                        } else {
                            self.slug = slug
                            cb(err)
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
    this.slugBooker =  []
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

    obj.prototype[prop + 'Add'] = function(obj, at) {
        obj.parent = this
        if(at) {
            at = parseInt(at, 10)
        }
        if(!isNaN(at)) {
            this[prop].splice(at, 0, obj)
        } else {
            this[prop].push(obj)
        }
    }

    obj.prototype[prop + 'Get'] = function(slug) {
        for(var i = 0; i < this[prop].length; i++) {
            if(this[prop][i].slug == slug) {
                return this[prop][i]
            }
        }
        return null
    }

    obj.prototype[prop + 'Move'] = function(obj, to, at) {
        this[prop + 'Remove'](obj)
        to[prop + 'Add'](obj, at)
    }

    obj.prototype[prop + 'Remove'] = function(obj) {
        var pos = this[prop].indexOf(obj)
        if(pos >= 0) {
            obj.parent = null
            this[prop].splice(pos, 1)
        }
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
}
Model.Board.prototype.asData = function(cb) {
    return {
        type: 'board',
        name: this.name,
        slug: this.slug,
        stacks: this.stacks.map(function(stack) {
            return stack.asData()
        })
    }
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
    // slug must be ok before writing.
    var join = Futures.join()
    var _toSlug = []
    if(!this.slug) {
        var f = Futures.future()
        join.add(f)
        _toSlug.push({obj: this, ns: 'board/'+this.model.db.name, future: f})
    }
    this.stacks.forEach(function(stack) {
        if(!stack.slug) {
            var f = Futures.future()
            join.add(f)
            _toSlug.push({obj: stack, ns: 'stack/'+stack.model.db.name, future: f})
        }
        stack.stickies.forEach(function(sticky) {
            if(!sticky.slug) {
                var f = Futures.future()
                join.add(f)
                _toSlug.push({obj: sticky, ns: 'sticky/'+sticky.model.db.name, future: f})
            }
        })
    })
    var saveAndFree = function() {
        var data = self.asData()
        var wrap = function(err, res) {
            self.id = res._id
            self.rev = res._rev
            _toSlug.forEach(function(item) {
                item.obj.freeSlug(item.ns, item.slug)
            })
            cb(err, self)
        }
        if(self.id) {
            self.model.db.save(self.id, data, wrap)
        } else {
            self.model.db.save(data, wrap)
        }           
    }
    
    if(_toSlug.length > 0) {
        join.when(saveAndFree)
        _toSlug.forEach(function(item) {
            item.obj.slugging(item.ns, item.future.deliver)
        })
    } else {
        saveAndFree()
    }
}

Model.Board.prototype.get = function(slug, cb) {
    var self = this
    this.model.db.view('boards/by_slug',
                 {key: slug},
                 function(err, res) {
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
                return new self.model.Board(board)
            }))
        }
    })
}

Model.Board.prototype.url = function() {
    return '/board/' + this.slug
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
    this.parent = data.parent instanceof Model.Board ? data.parent : new this.model.Board(data.parent)
    this.stickiesSet(data)
}
Model.Stack.prototype.asData = function(cb) {
    return {
        type: 'stack',
        name: this.name,
        slug: this.slug,
        stickies: this.stickies.map(function(stickies) {
            return stickies.asData()
        }),
        parent: {slug: this.parent.slug}
    }
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

Model.Stack.prototype.url = function() {
    return ['/board', this.parent.slug,
            'stack', this.slug].join('/')
}

Model.Sticky = function(model, data) {
    this.model = model
    this.slug = data.slug || null
    this.title = data.title || 'title'
    this.content = data.content || 'content'
    this.user = data.user || 'user'
    this.id = data._id || null
    this.rev = data._rev || null
    this.parent = data.parent
}

Model.Sticky.prototype.asData = function(cb) {
    return {
        type: 'sticky',
        slug: this.slug,
        title: this.title,
        content: this.content,
        user: this.user,
        parent: {slug: this.parent.slug, parent: {slug: this.parent.parent.slug}}
    }
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

Model.Sticky.prototype.url = function() {
    return ['/board', this.parent.parent.slug,
            'stack', this.parent.slug,
            'sticky', this.slug].join('/')
}

Model.Sticky.prototype.move = function(to) {
    this.parent.stickiesRemove(this)
    to.stack.stickiesAdd(this, to.pos)
}

var Stack = function() {}
Stack.prototype.add = function(sticky) {
    sticky.stack = this
    return this
}

Stack.prototype.save = function(cb) {
    var self = this
    var data = this.asData()
    if(this.slug) {
        this.parent.save(cb)
    } else {
        this.slugging(function(slug) {
            data.slug = slug
            self.slug = slug
            this.parent.save(data, function(err, res) {
                delete self._in_write_slugging[self._in_write_slugging.indexOf(data.board.slug + '/' + slug)]
                cb(err, self)
            })
        })
    }
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
