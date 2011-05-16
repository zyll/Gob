/**
 * use to group event for a client
 */
var Behaviours = function(event) {
    this.event = event
    this.list = []
}
/**
 * add an event listener to the group
 */
Behaviours.prototype.on = function(event, callback) {
    this.event.on(event, callback)
    this.list.push({on: event, callback: callback})
    return  this
}

/**
 *  start listening all groups event
 */
Behaviours.prototype.start = function() {
    for(var i in this.list) {
        this.event.on(this.list[i].event, this.list[i].callback)
    }
}

/**
 * remove all listener
 */
Behaviours.prototype.stop = function() {
    for(var i in this.list) {
        this.event.removeListener(this.list[i].event, this.list[i].callback)
    }
}

module.exports = Behaviours
