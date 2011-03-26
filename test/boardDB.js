var vows = require('vows')
  , assert = require('assert')
  , fs = require('fs')
  , sys = require('sys')
  , cradle = require('cradle')
  , Board = require('../lib').Board
  , Boards = require('../lib').Boards
  , Stack = require('../lib').Stack
  , Sticky = require('../lib').Sticky

  , testdb = "boardtest"


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
vows.describe('Given a board list').addBatch({
    'when intanciate a list named testboards': {
        topic: function() {
            var self = this
            var c = new(cradle.Connection)().database('testboards')
            c.exists(function(err, res) { 
                if(res) {
                    c.destroy(function(err, res) {
                        new Boards({name:'testboards'}, self.callback)
                    })
                } else {
                    new Boards({name:'testboards'}, self.callback)
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
            'it should callback with an empty list as args': function(topic) {
                assert.isArray(topic)
                assert.isEmpty(topic)
            },
            'when saving a new board \'test\'': {
                'topic': function(topic, boards) {
                    var b = new Board('test')
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
                    'it should callbacks a list with the board \'test\' with 3 stacks inside': function(err, topic) {
                        assert.instanceOf(topic[0], Board)
                        assert.equal(topic[0].name, 'test')
                        assert.equal(topic[0].stacks.length, 3)
                    }
                },
                'when getting the board test': {
                    'topic': function(board, err, boards) {
                        boards.get('test', this.callback)
                    },
                    'it should return the board \'test\'': function(err, topic) {
                        assert.instanceOf(topic, Board)
                        assert.equal(topic.name, 'test')
                    },
                    'it should have 3 empty stacks': function(err, topic) {
                        assert.equal(topic.stacks.length, 3)
                        for(var i = 0; i < 3; i++) {
                            assert.instanceOf(topic.stacks[i], Stack)
                        }
                    }
                },
                'when adding a sticky': {
                    'topic': function(board, err, boards) {
                        return board.stacks[0].add(new Sticky({title: 'title',
                                                              content: 'content',
                                                              user: 'user'}))
                    },
                    'it should return a Stack with a sticky inside': function(err, stack) {
                        assert.instanceOf(stack, Stack)
                        assert.equal(stack.stickies.length, 1)
                        assert.instanceOf(stack.stickies[0], Sticky)
                    },
                    'when savind and then fetching the board': {
                        'topic': function(stack, board, err, boards) {
                            var self = this
                            board.save(function() {
                                boards.get('test', self.callback)
                            })
                        },
                        'it should find a sticky in the first stack': function(err, board) {
                            assert.equal(board.stacks[0].stickies.length, 1)
                            assert.instanceOf(board.stacks[0].stickies[0], Sticky)
                            assert.equal(board.stacks[0].stickies[0].title, 'title')
                        },
                        'when removing sticky from the stack': {
                            'topic': function(board, stack, board_, err, boards) {
                                var self = this
                                boards.get('test', function(err, board) {
                                    stack.remove(stack.stickies[0], self.callback)
                                })
                            },
                            'it should return the stack object': function(err, stack) {
                                assert.instanceOf(stack, Stack)
                            },
                            'it should have empty stack': function(err, stack) {
                                assert.isEmpty(stack.stickies)
                            },

                            'When fetching boards': {
                                'topic': function(arr, stack) {
                                    var self = this
                                    stack.board.boards.get('test', self.callback)
                                },
                                'it should have empty stack': function(err, board) {
                                    console.log(arguments)
                                    assert.isEmpty(board.stacks[0].stickies)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}).export(module);
