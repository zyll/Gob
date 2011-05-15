/**
 *
 */
var Schema = require('JSV').JSV

var Form = function(schema) {
    this._env = Schema.createEnvironment()
    this._schema = schema
    this._expects = []
}

/**
* add a test as a function that return a boolean
* on fail, msg and prop will be use to set the erro msg on the properies
*/
Form.prototype.expect = function(error, expect) {
    this._expects.push({error: error, expect: expect})
}

Form.prototype.fit = function(data, form) {
    return new FormFit(data, this)
}

var FormFit = function(data, form) {
    this.fields = data
    this.errors = []
    this.fail = {}
    this._schema = form._schema
    this._expects = form._expects
    this._env = form._env
    this.ok = false
}

FormFit.prototype.validateExpects = function(expects) {
    for(var i in expects) {
        if(!expects[i].expect.call(this)) {
            var error = expects[i].error
            if(!this.fail[error.prop]) {this.fail[error.prop] = []}
            this.fail[error.prop].push(error.msg)
            this.ok = false
        }
    }
}

FormFit.prototype.validateSchema = function(schema) {
    var self = this
    var schema_res = this._env.validate(this.fields, this._schema)
    schema_res.errors.forEach(function(error) {
        var prop = error.schemaUri.split('/').pop()
        if(!self.fail[prop]) {
            self.fail[prop] = []
        }
        self.fail[prop].push(error.message)
    })
    this.ok = schema_res.errors.length === 0
}
    
FormFit.prototype.validate = function() {
    this.validateSchema(this._schema)
    this.validateExpects(this._expects)
    return this
}

module.exports = Form
