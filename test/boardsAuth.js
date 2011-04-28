var vows = require('vows')
  , assert = require('assert')
  , Model = require('../models/board')
  , Make = require('./scripts/make')

vows.describe('Model.User').addBatch({
    'Given an unknown db state for test': {
        topic: function() {
            Make.clean().when(this.callback)
        },
        'should be clean': function(whatever) {assert.ok(true)}
    }
}).addBatch({
    'Given a populated db "board_test_board"': {
        topic: function() {
            var self = this
            Make.populate().when(function(){
                new Model({name: 'board_test_board'})
                    .migrate(self.callback)
            })
        },
        'should be populate': function(err, whatever) {assert.ok(true)}
    }
}).addBatch({
    'Given A new Model for "board_test_board"': {
        topic: function() {
            this.callback(null, new Model({name: 'board_test_board'}))
        },
        'when getting the user': {
            topic: function(err, model) {
                var user = new model.User()
                    .get('user1', this.callback)
            },
            'it should return the user user1': function(err, user) {
                assert.equal(user.password, 'secret')
            },
            'when asking if user1 can read board "moving"': {
                topic: function(err, user) {
                    user.can(new user.model.Board({slug: 'moving'}), 1)
                        .accept(this.callback)
                },
                'it should callback on accept': function() {
                    assert.ok(true)
                }
            },
            'when asking if user1 can write on board "moving"': {
                topic: function(err, user) {
                    user.can(new user.model.Board({slug: 'moving'}), 2)
                        .refuse(this.callback)
                },
                'it should callback on refuse': function() {
                    assert.ok(true)
                }
            },
            'when asking user1 boards list"': {
                topic: function(err, user) {
                    new user.model.Board()
                        .knownBy('user1', this.callback)
                },
                'it should find 1 board named "moving"': function(err, boards) {
                    assert.equal(boards.length, 1)
                    assert.equal(boards[0].name, "moving")
                }
            },
        },
    }
}).addBatch({
    'Given A new Model for "board_test_board"': {
        topic: function() {
            this.callback(null, new Model({name: 'board_test_board'}))
        },
        'when getting the user': {
            topic: function(err, model) {
                var user = new model.User()
                    .get('user1', this.callback)
            },
            'when upgrading user1 rights on board "moving" to "write"': {
                topic: function(err, user) {
                    var self = this
                    new user.model.Board().get('moving', function(err, board) {
                        board.authorize(user, 2)
                            .save(self.callback)
                    })
                },
                'when asking for user1 has write rights on board moving': {
                    topic: function(err, board) {
                        new board.model.User({nick: 'user1'})
                            .can(board, 2)
                            .accept(this.callback)
                    },
                    'it should callback accept': function() {
                        assert.ok(true)
                    }
                }
            }
        },
    }
}).addBatch({
    'Given cleaning db from test': {
        topic: function() {
            Make.clean().when(this.callback)
        },
        'should be clean': function(whatever) {assert.ok(true)}
    }
}).export(module, {error: false});
