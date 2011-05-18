var Form = require('../libs/form')

var BoardRight = new Form({
    type: 'object',
    properties: {
        nick: {
            type: 'string',
            minLength: 1
        },
        level: {
            type: 'string',
            item: ['0', '1', '2', '3']
        }
    }
})

module.exports = BoardRight
