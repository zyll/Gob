/**
 * Session store in a file from http://pastebin.com/ZmbN4Vtt
 */

var fs = require('fs')
  , sys = require('sys')
  , connect = require('connect')
  , Store = connect.session.Store

var FileStore = function FileStore(options) {
        options = options || {};
        this.storeFilename = options.storeFilename || './sessions.json';
        this.sessions = {};
        this.loadSessions();
};

FileStore.prototype.__proto__ = Store.prototype;

FileStore.prototype.loadSessions = function() {
        try { 
                var data = fs.readFileSync(this.storeFilename);
                this.sessions = JSON.parse(data);
        } catch (e) {
                this.sessions = {};
        }
}

FileStore.prototype.storeSessions = function() {
        fs.writeFileSync(this.storeFilename+".tmp", JSON.stringify(this.sessions));
        fs.renameSync(this.storeFilename+".tmp", this.storeFilename);
}

FileStore.prototype.get = function(sid, fn){
        if (sid in this.sessions) {
                fn(null, JSON.parse(this.sessions[sid]));
        } else {
                fn();
        }
};

FileStore.prototype.set = function(sid, sess, fn){
        this.sessions[sid] = JSON.stringify(sess);
        this.storeSessions();
        process.nextTick(function() {
                fn && fn();
        });
};

FileStore.prototype.destroy = function(sid, fn){
        delete this.sessions[sid];
        this.storeSessions();
        fn && fn();
};

FileStore.prototype.all = function(fn){
        var arr = [],
                keys = Object.keys(this.sessions);
        for (var i = 0, len = keys.length; i < len; ++i) {
                arr.push(this.sessions[keys[i]]);
        }
        fn(null, arr);
};


FileStore.prototype.clear = function(fn){
        this.sessions = {};
        this.storeSessions();
        fn && fn();
};

FileStore.prototype.length = function(fn){
        fn(null, Object.keys(this.sessions).length);
};

module.exports = FileStore
