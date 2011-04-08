var vows = require('vows')
  , assert = require('assert')
  , Model = require('../models/board')
  , Make = require('./scripts/make')

vows.describe('Model').addBatch({
    'Given an unknown db state for test': {
        topic: function() {
            Make.clean().when(this.callback)
        },
        'should be clean': function(whatever) {assert.ok(true)}
    }
}).addBatch({
    'Given A new Model using "board_testmodel"': {
        topic: function() {
            return new Model({name: 'board_testmodel'})
        },
        'should ack': function(res) {
            assert.instanceOf(res, Model)
        },
        'when create the DB': {
            topic: function(model) {
                model.createDB(this.callback)
            },
            'should ack': function(err, res) {
                assert.ok(true)
            }
        }
    }
}).addBatch({
    'Given cleaning db from test': {
        topic: function() {
            Make.clean().when(this.callback)
        },
        'should be clean': function(whatever) {assert.ok(true)}
    }
}).export(module, {error: false});
