var Form = require('../libs/form')

var UserForm = new Form({
    type: 'object',
    properties: {
        nick: {
            type: 'string',
            minLength: 4
        },
        password: {
            type: 'string',
            minLength: 6
        },
        confirm: {
            type: 'string',
            minLength: 6
        }
    }
})

UserForm.expect({prop: 'confirm', msg: 'Should be the same as the confirm field'}, function() {
    return this.fields.password == this.fields.confirm
})

module.exports = UserForm
