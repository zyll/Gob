var vows = require('vows')
  , assert = require('assert')
  , Model = require('../models/board')
  , Make = require('./scripts/make')

vows.describe('Model.Board').addBatch({
    'Given an unknown db state for test': {
        topic: function() {
            Make.clean().when(this.callback)
        },
        'should be clean': function(whatever) {assert.ok(true)}
    }
}).addBatch({
    'Given A new Model with a created db': {
        topic: function() {
            var self = this
            var model = new Model({name: 'board_testmodel'})
            model.createDB(function(){
                self.callback(null, model)
            })
        },
        'when instanciate a new board': {
            topic: function(err, model) {
                this.callback(null, new model.Board({name: 'board 123é5'}), model)
            },
            'know the model': function(err, board, model) {
                assert.equal(board.model, model)
            },
            'and when save it': {
                topic: function(err, board, model) {
                    board.save(this.callback)
                },
                'it shoud have an id': function(err, board, model) {
                    assert.ok(board.id)
                },
                'it shoud have a slug': function(err, board, model) {
                    assert.equal(board.slug, 'board-123%E9')
                }
            }
        }
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
    'Given A new Model or "board_test_board"': {
        topic: function() {
            this.callback(null, new Model({name: 'board_test_board'}))
        },
        'when getting all the board': {
            topic: function(err, model) {
                new model.Board()
                    .all(this.callback)
            },
            'it should return a list': function(err, boards) {
                assert.isArray(boards)
                assert.equal(boards.length, 2)
            },
            'it should not have any deep board info': function(err, boards) {
                assert.equal(boards[0].stacks.length, 0)
                assert.equal(boards[1].stacks.length, 0)
            }
        },
        'when getting the board "conquer the world"': {
            topic: function(err, model) {
                new model.Board()
                    .get('conquer-th', this.callback)
            },
            'it should return a Board': function(err, board) {
                assert.instanceOf(board, Model.Board)
            },
            ' and 3 stacks': function(err, board) {
                assert.equal(board.stacks.length, 3)
                board.stacks.forEach(function(stack) {
                    assert.instanceOf(stack, Model.Stack)
                })
            },
            'and the first stack': {
                topic: function(err, board){
                    return board.stacks[0]
                },
                'should have 2 stickies': function(stack) {
                    assert.equal(stack.stickies.length, 2)
                    stack.stickies.forEach(function(sticky) {
                        assert.instanceOf(sticky, Model.Sticky)
                    })
                },
                'and the first stickies': {
                    topic: function(stack){
                        return stack.stickies[0]
                    },
                    'should be "get an army"': function(sticky) {
                        assert.equal(sticky.title, "get an army")
                    }
                }
            }
        },
        'when getting all the stack from "conquer the world"': {
            topic: function(err, model) {
                new model.Stack({parent: {slug: 'conquer-th'}})
                    .all(this.callback)
            },
            'it should return a Stack list': function(err, stacks) {
                assert.isArray(stacks)
                assert.equal(stacks.length, 3)
                stacks.forEach(function(stack) {
                    assert.instanceOf(stack, Model.Stack)
                })
            },
            'there is a todo stack': {
                topic: function(err, stacks){
                    for(var i in stacks)
                        if(stacks[i].name == 'todo') {
                            return stacks[i]
                        }
                },
                'should have 2 stickies': function(stack) {
                    assert.equal(stack.stickies.length, 2)
                    stack.stickies.forEach(function(sticky) {
                        assert.instanceOf(sticky, Model.Sticky)
                    })
                },
                'and the first stickies': {
                    topic: function(stack){
                        return stack.stickies[0]
                    },
                    'should be "get an army"': function(sticky) {
                        assert.equal(sticky.title, "get an army")
                    }
                }
            }
        },
        'when getting the stack todo from "conquer the world"': {
            topic: function(err, model) {
                new model.Stack({parent: {slug: 'conquer-th'}})
                    .get('todo', this.callback)
            },
            'it should return a Stack named todo': function(err, stack) {
                assert.instanceOf(stack, Model.Stack)
                assert.equal(stack.name, 'todo')
            },
            'it should have 2 stickies': function(err, stack) {
                assert.equal(stack.stickies.length, 2)
                stack.stickies.forEach(function(sticky) {
                    assert.instanceOf(sticky, Model.Sticky)
                })
            },
            'and the first stickies': {
                topic: function(err, stack){
                    return stack.stickies[0]
                },
                'should be "get an army"': function(sticky) {
                    assert.equal(sticky.title, "get an army")
                }
            }
        },
        'when getting all the sticky from stack todo of "conquer the world"': {
            topic: function(err, model) {
                new model.Sticky({parent: {slug: 'todo', parent: {slug: 'conquer-th'}}})
                    .all(this.callback)
            },
            'it should return a Sticky list': function(err, stickies) {
                assert.isArray(stickies)
                assert.equal(stickies.length, 2)
                stickies.forEach(function(sticky) {
                    assert.instanceOf(sticky, Model.Sticky)
                })
            },
            'there is a "get an army" sticky': {
                topic: function(err, stickies){
                    var find = false
                    for(var i in stickies)
                        if(stickies[i].title == 'get an army')
                            find = true
                    assert.ok(find)
                },
            }
        },
        'when getting sticky "get-an-arm" from the stack todo from "conquer the world"': {
            topic: function(err, model) {
                new model.Sticky({parent: {slug: 'todo', parent: {slug: 'conquer-th'}}})
                    .get('get-an-arm', this.callback)
            },
            'it should return a Sticky titled "get an army"': function(err, sticky) {
                assert.instanceOf(sticky, Model.Sticky)
                assert.equal(sticky.title, 'get an army')
            },
        }

    }
}).addBatch({
    'Given A new Model or "board_test_board"': {
        topic: function() {
            this.callback(null, new Model({name: 'board_test_board'}))
        },
        'when saving a board named "myboard"': {
            topic: function(err, model) {
                new model.Board({name: "myboard"})
                    .save(this.callback)
            },
            'it should return a board with an id and a slug': function(err, board) {
                assert.instanceOf(board, Model.Board)
                assert.ok(board.id)
                assert.equal(board.name, 'myboard')
                assert.equal(board.slug, 'myboard')
            },
            'when getting the "myboard" board': {
                topic: function(err, board, err2, model) {
                    new model.Board()
                        .get("myboard", this.callback)
                },
                'it should return that board': function(err, board) {
                    assert.instanceOf(board, Model.Board)
                    assert.equal(board.name, "myboard")
                    assert.equal(board.slug, "myboard")
                }
            },
            'when adding a new "myboard" board': {
                topic: function(err, board, err2, model) {
                    new model.Board({name: 'myboard'})
                        .save(this.callback)
                },
                'it should save it with a different slug': function(err, board) {
                    assert.equal(board.slug, "myboard-1")
                }
            }

        }
    }
})
.addBatch({
    'Given the board "myboard" on "board_test_board"': {
        topic: function() {
            new (new Model({name: 'board_test_board'}).Board)()
                .get('myboard', this.callback)
        },
        'when adding a stack named "todo"': {
            topic: function(err, board) {
                board.stacksAdd(new board.model.Stack({name: 'todo'}))
                board.save(this.callback)
            },
            'it should return a board with a stack in its stacks list': function(err, board) {
                assert.equal(board.stacks.length, 1)
                assert.instanceOf(board.stacks[0], Model.Stack)
                console.log(board)
            },
            'when getting the "myboard" board': {
                topic: function(err, board) {
                    board.get("myboard", this.callback)
                },
                'it should return that board': function(err, board) {
                    assert.instanceOf(board, Model.Board)
                    assert.equal(board.name, "myboard")
                    assert.equal(board.slug, "myboard")
                },
                'it should have a the stack': function(err, board) {
                    console.log(board)
                    assert.equal(board.stacks.length, 1)
                    assert.instanceOf(board.stacks[0], Model.Stack)
                    assert.equal(board.stacks[0].name, "myboard")
                }
            }
        }
    }
})
.addBatch({
    'Given cleaning db from test': {
        topic: function() {
            Make.clean().when(this.callback)
        },
        'should be clean': function(whatever) {assert.ok(true)}
    }
}).export(module, {error: false});
/*vows.describe('A boards db').addBatch({
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
                new Boards(db)
                    .init(this.callback)
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
                            boards.get({slug: 'test'}, this.callback)
                        },
                        'it should return the board \'test\'': function(err, board) {
                            assert.instanceOf(board, Board)
                            assert.equal(board.name, 'test')
                            assert.equal(board.slug, 'test')
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
                                'topic': function() {
                                    new Board(db, {slug: 'test'})
                                        .get({slug: 'todo'}, this.callback)
                                },
                                'it should return a Stack object': function(err, stack) {
                                    assert.instanceOf(stack, Stack)
                                    assert.equal(stack.board.slug, 'test')
                                    assert.equal(stack.slug, 'todo')
                                    assert.equal(stack.url(), '/board/test/stack/todo')
                                },
                                'when adding a sticky to the stack': {
                                    'topic': function(stack) {
                                        var sticky = new Sticky(db, {title: 'title me &$ other',
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
                                            new Stack(db, {slug: 'todo', board: {slug: 'test'}})
                                            .get({slug: 'title-me-%26'}, this.callback)
                                        },
                                        'it should return a sticky': function(err, sticky) {
                                            assert.instanceOf(sticky, Sticky)
                                            assert.equal(sticky.title, 'title me &$ other')
                                            assert.equal(sticky.url(), '/board/test/stack/todo/sticky/title-me-%26')
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
                                                    new Stack(db, {slug: 'todo', board: {slug: 'test'}})
                                                    .get({slug: 'title-me-%26'}, this.callback)
                                                },
                                                'it should return null': function(err, sticky) {
                                                    assert.isNull(sticky)
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
                new Boards(db2)
                    .init(function(err, boards) {
                    var todo = 12
                      , done = function() {
                        if(--todo == 0) cb(null, boards)
                    }
                    var w_stickies = function (err, stack) {
                        ['A', 'B'].forEach(function(sticky) {
                            new Sticky(db2, {title: stack.board.name + stack.name + sticky, stack: stack})
                                .save(done)
                        })
                    }
                    var w_stacks = function (err, board) {
                        ['todo', 'progress', 'deploy'].forEach(function(stack) {
                            new Stack(db2, {name: stack, board: board})
                                .save(w_stickies)
                        })
                    }
                    ;['test1', 'test2'].forEach(function(board) {
                        var b = new Board(db2, {name: board})
                        boards.add(b)
                        b.save(w_stacks)
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
                boards.get({slug: 'test2'}, this.callback)
            },
            'it should be the board test2': function(err, board) {
                assert.isNull(err)
                assert.equal(board.name, 'test2')
            },
            'when searching the todo stack': {
                'topic': function(board) {
                    new Board(db2, {slug: 'test2'})
                        .get({slug: 'deploy'}, this.callback)
                },
                'it should return the todo stack for this board': function(err, stack) {
                    assert.isNull(err)
                    assert.equal(stack.name, 'deploy')
                },
                'when getting the sticky': {
                    'topic': function(stack) {
                        stack.get({slug: 'test2deplo-1'}, this.callback)
                    },
                    'it should return the sticky': function(err, sticky) {
                        assert.isNull(err)
                        assert.ok(sticky.title.match(/^test2deploy[AB]$/))
                    }
                },
                'when getting all the sticky for test2 deploy': {
                    'topic': function(stack) {
                        stack.all(this.callback)
                    },
                    'it should return 2 stickies': function(err, stickies) {
                        assert.isNull(err)
                        assert.equal(stickies.length, 2)
                        stickies.forEach(function(s) {
                            assert.ok(s.slug.match(/^test2(deplo|todo(A|B)|progr)(\-\d)?$/))
                        })
                        assert.isFalse((stickies[0].slug == stickies[1].slug))
                    }
                }
            }

        }
    }
}).export(module);
*/
