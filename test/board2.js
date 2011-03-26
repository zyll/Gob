var vows = require('vows')
  , assert = require('assert')
  , fs = require('fs')
  , sys = require('sys')
  , cradle = require('cradle')
  , Board = require('../lib').Board
  , Boards = require('../lib').Boards
  , Stack = require('../lib').Stack
  , Sticky = require('../lib').Sticky

  , db = Boards.client({name: 'testboards'})


    // * from scratch (db = 'boardtest')
    //   * empty list
    // * add board 'test'
    //   * board is in list
    //   * boards has 3 stacks
    //   * stack are empty
    // * add sticky ('title', 'content', 'user') to test
    //   * test.stack[0] have a sticky
    //   * sticky have title, content and user
    // * get sticky
    //   * sticky have title, content and user
    // * update sticky ('mytitle', 'mycontent', 'anotheruser')
    //   * sticky have mytitle, mycontent and myuser
    // * move sticky to test.stack[1]
    //   * test.stack[0] is empty
    //   * test.stack[1] has one sticky
    // * remove sticky
    //   * test.stack[0] is empty
    // test Events.
    // test Users.
 var test = vows.describe('Given an empty db').addBatch({
    'when intanciate a list named testboards': {
        topic: function() {
            var self = this
            //cleanning test db.
            db.exists(function(err, res) {
                if(res) { db.destroy(function() {
                    new Boards(db, self.callback)
                })} else {
                    new Boards(db, self.callback)
                }
            })
        },
        'it should create a db named testboards': function(err, boards) {
            new(cradle.Connection)().database('testboards').exists(function(err, res) {
                assert.ok(res)
            })
        },
        'when getting boards list': {
            'topic': function(boards) {
                boards.all(this.callback)
            },
            'it should callback with an empty list': function(topic) {
                assert.isArray(topic)
                assert.isEmpty(topic)
            },
            'when saving a new board \'test\'': {
                'topic': function(topic, boards) {
                    var b = new Board(db, {name: 'test'})
                    boards.add(b)
                    b.save(this.callback)
                },
                'it should callback with a Board': function(err, board) {
                    assert.isNull(err)
                    assert.instanceOf(board, Board)
                },
                'when getting all the boards': {
                    'topic': function(board, err, boards) {
                        boards.all(this.callback)
                    },
                    'it should callbacks a list with the board \'test\'': function(err, topic) {
                        assert.instanceOf(topic[0], Board)
                        assert.equal(topic[0].name, 'test')
                    }
                },
                'when getting the board test': {
                    'topic': function(board, err, boards) {
                        boards.get({name: 'test'}, this.callback)
                    },
                    'it should return the board \'test\'': function(err, board) {
                        assert.instanceOf(board, Board)
                        assert.equal(board.name, 'test')
                        assert.isNotNull(board.id)
                    },
                    'when adding a stack': {
                        'topic': function(board, err, boards) {
                            var stack = new Stack(db, {name: 'todo', board: board})
                            board.add(stack)
                            stack.save(this.callback)
                        },
                        'it should return a Stack object': function(err, stack) {
                            assert.instanceOf(stack, Stack)
                        },
                        'when getting a stack': {
                            'topic': function(err, stack) {
                                new Board(db, {name: 'test'})
                                    .get({name: 'todo'}, this.callback)
                            },
                            'it should return a Stack object list': function(err, stacks) {
                                assert.isArray(stacks)
                                assert.equal(stacks.length, 1)
                                assert.instanceOf(stacks[0], Stack)
                                assert.equal(stacks[0].board.name, 'test')

                            },
                            'when adding a sticky to the stack': {
                                'topic': function(stacks) {
                                    var sticky = new Sticky(db, {title: 'title',
                                                                content: 'content',
                                                                user: 'user'})
                                    stacks[0].add(sticky)
                                    sticky.save(this.callback)

                                },
                                'it should return a Sticky object': function(err, sticky) {
                                    assert.instanceOf(sticky, Sticky)
                                    assert.isNotNull(sticky.id)
                                    assert.equal(sticky.stack.name, 'todo')
                                },
                                'when get the sticky': {
                                    'topic': function() {
                                        new Stack(db, {name: 'todo', board: {name: 'test'}})
                                            .get({title: 'title'}, this.callback)
                                    },
                                    'it should return a stickies list with one sticky': function(err, stickies) {
                                        assert.equal(stickies.length, 1)
                                        assert.instanceOf(stickies[0], Sticky)
                                        assert.equal(stickies[0].title, 'title')
                                    },
                                    'when removing sticky from the stack': {
                                        'topic': function(stickies) {
                                            stickies[0].remove(this.callback)
                                        },
                                        'it should ack': function(err, res) {
                                            assert.isNull(err)
                                        },
                                        'When fetching sticky': {
                                            'topic': function() {
                                                new Stack(db, {name: 'todo', board: {name: 'test'}})
                                                    .get({title: 'title'}, this.callback)
                                            },
                                            'it should return empty list': function(err, stickies) {
                                                assert.isEmpty(stickies)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}).export(module);
