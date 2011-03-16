/**
 *
*/
// Required system libraries
var fs = require('fs')
  , jade = require('jade')
  , sys = require('sys')
  , libxml = require('libxmljs')

var dir = __dirname + '/boards/'
var tpls = __dirname + '/jade'

/**
 * Persistencce for Board.
 * @todo be awar about repos exist.
 * @todo security need some check on realpath
 */
var Board = function(name) {
    this.name = name
    this.data = null
}

/**
 * load persisted data.
 * @params {Function(err, data)} callback on complete
 */
Board.prototype.load = function(cb) {
    var self = this
    fs.readFile(dir + this.name + '/index.html', 'utf-8', function(err, data) {
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
    fs.writeFile( dir + this.name + '/index.html', html, 'utf-8', function(err, data) {
        if(err) {
            cb(err)
        } else {
            self.setData(data)
            console.log(data)
            cb(err, data)
        }
    })
}

/**
 * write a new initialized board.
 * @params {Function(err, data)} callback on complete
 */
Board.prototype.create = function(cb) {
    var self = this
    fs.mkdir(dir + this.name, '766', function(err) {
        if(err) {
            cb(err)
        } else {
            // compile an empty board
            jade.renderFile( tpls + '/board_empty.jade', function(err, html) {
                // write the empty board in the new repos
                self.save(html, function(err) {
                    cb(err, html)
                })
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
        fs.writeFile( dir + self.name + '/deployed-' + Date.now() + '.html', stack[0].toString(), 'utf-8', function(err, data) {
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
