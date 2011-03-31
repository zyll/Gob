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
, db2 = Boards.client({name: 'testboards_filled'})

vows.describe('A boards db').addBatch({
    'Given An empty db named \'testborads\'': {
        topic: function() {
            var self = this
            db.exists(function(err, res) {
                if(res) {
                    db.destroy(self.callback)
                } else {
                    self.callback()
                }
            })
        },
        'when intanciate a list named testboards': {
            topic: function() {
                new Boards(db, this.callback)
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
                        assert.equal(board.url(), '/board/test')
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
                                'it should return a Stack object': function(err, stack) {
                                    assert.instanceOf(stack, Stack)
                                    assert.equal(stack.board.name, 'test')
                                    assert.equal(stack.url(), '/board/test/stack/todo')
                                },
                                'when adding a sticky to the stack': {
                                    'topic': function(stack) {
                                        var sticky = new Sticky(db, {title: 'title',
                                                                slug: 'title',
                                                                content: 'content',
                                                                user: 'user'})
                                        stack.add(sticky)
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
                                            .get({slug: 'title'}, this.callback)
                                        },
                                        'it should return a sticky': function(err, sticky) {
                                            assert.instanceOf(sticky, Sticky)
                                            assert.equal(sticky.title, 'title')
                                            assert.equal(sticky.url(), '/board/test/stack/todo/sticky/title')
                                        },
                                        'when removing sticky from the stack': {
                                            'topic': function(sticky) {
                                                sticky.remove(this.callback)
                                            },
                                            'it should ack': function(err, res) {
                                                assert.isNull(err)
                                            },
                                            'When fetching sticky': {
                                                'topic': function() {
                                                    new Stack(db, {name: 'todo', board: {name: 'test'}})
                                                    .get({title: 'title'}, this.callback)
                                                },
                                                'it should return null': function(err, sticky) {
                                                    assert.isEmpty(sticky)
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
    }
}).addBatch({
    'Given a filled db named \'testboards_filled\'': {
        topic: function() {
            var self = this
            var fill = function(cb) {
                new Boards(db2, function(err, boards) {
                    todo = 12 
                    done = function() {
                        if(--todo == 0) {
                            cb(null, boards)
                        }
                    };
                    ['test1', 'test2'].forEach(function(board){
                        new Board(db2, {name: board})
                            .save(done);
                        ['todo', 'progress', 'deploy'].forEach(function(stack) {
                            new Stack(db2, {name: stack, board:{name: board}})
                                .save(done);
                            ['A', 'B'].forEach(function(sticky) {
                                new Sticky(db2, {title: board+stack+sticky, stack: {name: stack, board:{name: board}}})
                                    .save(done)
                            })
                        })
                    })
                })
            }
            db2.exists(function(err, res) {
                if(res) {
                    db2.destroy(function(){fill(self.callback)})
                } else {
                    fill(self.callback)
                }
            })
        },
        'when searching for a  board \'test1\'': {
            topic: function(boards) {
                boards.get({name: 'test2'}, this.callback)
            },
            'it should be the board test2': function(err, board) {
                assert.isNull(err)
                assert.equal(board.name, 'test2')
            },
            'when searching the todo stack': {
                'topic': function(board) {
                    board.get({name: 'deploy'}, this.callback)
                },
                'it should return the todo stack for this board': function(err, stack) {
                    assert.isNull(err)
                    assert.equal(stack.name, 'deploy')
                },
                'when getting the sticky': {
                    'topic': function(stack) {
                        stack.get({slug: 'test2deplo1'}, this.callback)
                    },
                    'it should return the sticky': function(err, sticky) {
                        assert.isNull(err)
                        assert.ok(sticky.title.match(/^test2deploy[AB]$/))
                    }
                },
                'when getting all the sticky for test2': {
                    'topic': function(stack) {
                        stack.all(this.callback)
                    },
                    'it should return 6 stickies': function(err, stickies) {
                        assert.isNull(err)
                        assert.equal(stickies.length, 6)
                        stickies.forEach(function(s) {
                            assert.ok(s.slug.match(/^test2(deplo|todo(A|B)|progr)1?$/))
                        })
                    }
                }
            }

        }
    }
}).export(module);
