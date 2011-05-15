var vows = require('vows')
  , assert = require('assert')
  , Form = require('../libs/form')

vows.describe('Form').addBatch({
    'Given a form instance with a schema': {
        topic: function() {
            return new Form({
                type: 'object',
                properties: {
                    nick: {
                        type: 'string',
                        minLength: 1
                    },
                    pwd: {
                        type: 'string',
                        minLength: 1
                    },
                    confirm: {
                        type: 'string',
                        minLength: 1
                    }

                }
            })
        },
        'should have a schema': function(form) {
            assert.isObject(form._schema)
        },
        'When adding computational condition': {
            topic: function(form) {
                form.expect({prop: 'pwd', msg: 'Should be the same as the confirm field'}, function() {
                    return this.fields.pwd == this.fields.confirm
                })
                return form
            },
            'it should have regiter it': function(form) {
                assert.equal(form._expects.length, 1)
            },
            'When form is use to fit some good data': {
                topic: function(form) {
                    return form.fit({nick: 'me', pwd: 'p1', confirm: 'p1'})
                },
                'it should keep the data in the "fields property"': function(form) {
                    assert.deepEqual(form.fields, {nick: 'me', pwd: 'p1', confirm: 'p1'})
                },
                'its shouldnt be valide before using validate method': function(form) {
                    assert.isFalse(form.ok)
                },
                'When validate': {
                    topic: function(form) {
                        form.validate()
                        return form
                    },
                    'its fail property shouldnt handle the property ': function(form) {
                        assert.ok(form.ok)
                        assert.isObject(form.fail)
                        assert.deepEqual(form.fail, {})
                    }
                }
            },
            'When form is use to fit some errors data': {
                topic: function(form) {
                    return form.fit({nick: '', pwd: '', confirm: 'i'}).validate()
                },
                'it should keep the data in the "fields property"': function(form) {
                    assert.deepEqual(form.fields, {nick: '', pwd: '', confirm: 'i'})
                },
                'its fail property should be filled accordingly with msg for each field': function(form) {
                    assert.ok(!form.ok)
                    assert.deepEqual(form.fail, {
                        nick: ['String is less then the required minimum length'],
                        pwd: ['String is less then the required minimum length', 'Should be the same as the confirm field'],
                    })
                }
            }
        }
    }
}).export(module, {error: false});
