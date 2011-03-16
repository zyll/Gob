var vows = require('vows')
  , assert = require('assert')
  , fs = require('fs')
  , Board = require('../lib').Board

vows.describe('Given an empty board').addBatch({
    'named test': {
        topic: function() {
            return new Board('__test__')
        },
        'should be inititialize as an empty board named "test': function(topic) {
            assert.equal(topic.name, '__test__')
            assert.isNull(topic.data)
        },
        'when persited': {
            'topic': function(topic) {
                console.log(topic)
                topic.create(this.callback)
            },
            'a test repos should be created': function(topic) {
                assert.isNotNull(fs.statSync(__dirname + '/../boards/__test__'))
            },
            'a board data file should be created': function(topic) {
                assert.isNotNull(fs.statSync(__dirname + '/../boards/__test__/index.html'))
            },
            'board should handle its data': function(topic) {
                assert.isNotNull(topic.data)
            },
            'And reborned': {
                'topic': function() {
                    var self = this
                    var board = new Board('__test__')
                    board.load(function(err, data) {
                        // keep board in mind
                        self.callback(err, board)
                    })
                },
                'board should handle data': function(topic) {
                    assert.isNotNull(topic.data)
                },
            }
        }
    }
}).export(module);
