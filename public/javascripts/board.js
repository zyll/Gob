
function Board(element) {
    var self = this;
    this.element = element;
    this.stacks = [];
    this.element.find('.stack').each(function() {
        var stack = new Stack($(this), self);
        self.addStack(stack);
    });
}

Board.prototype.connectStack = function() {
    var self = this;
    var res = []
    $.each(this.stacks, function(index, stack) {
        res.push(stack.holder[0]);
    });
    console.log(res);
    $(res).sortable({
        connectWith: res,
        receive: function() {
            self.element.trigger('ticket:move');
        }
    });
}

Board.prototype.addStack = function(stack) {
    this.stacks.push(stack);
}

Board.prototype.save = function(url) {
    var self = this;
    $.ajax({
        url: url,
        dataType: 'html',
        data: this.element.parent().html(),
        type: 'post',
        processData: false,
        contentType: 'text/html',
        success: function() {
            self.element.trigger('board:saved');
        }
    });
}

Board.prototype.deploy = function(url) {
    var self = this;
    $.ajax({
        url: url,
        type: 'post',
        processData: false,
        contentType: 'text/html',
        success: function() {
            self.element.trigger('board:deployed');
        }
    });
}

function Stack(element, board) {
    var self = this;
    this.board = board;
    
    // our stack element.
    this.element = element;
    this.holder = this.element.find('ul');
    this.name = this.element.attr('id');
    
    // owned tickets collection.
    this.tickets = [];
    this.element.find('article').each(function(index, element) {
        self.add(element);
    });
}

Stack.prototype.add = function(el) {
    var ticket = new Ticket(el, $(this));
    this.tickets.push(ticket);
}

Stack.prototype.append = function(el) {
    this.holder.append('<li>');
    this.add($(el).appendTo(this.holder.find('li:last')[0]).attr('id', null));
    this.element.trigger('ticket:new');
}

function Ticket(element, stack) {
    var self = this;
    this.element = element;
    this.stack = stack;
    $(this.element).find('.editable').editable(function(value, settings) {
        return(value);
    }, { 
        type  : 'textarea',
        submit: 'OK',
        cancel: 'Cancel',
        callback: function(value, settings) {
            console.log('I');
            $(self.element).trigger("ticket:change");
        }
    });
}

$(document).ready( function() {
    
    // Trash stack

    $('.board').each(function() {
        
        // instanciate the board
        var board = new Board($(this));

        // auto save on ticket change, ticket move or board deployed.
        board.element.bind('ticket:change ticket:move ticket:new ticket:trash', function() {
            board.save(location.href);
        });

        var trash = new Stack($("section.trash"), board);
        board.addStack(trash);

        board.connectStack();
        // use template to add new ticket to the first stack
        $('#addSticky').bind('click', function(event) {
            event.preventDefault();
            board.stacks[0].append($('#tplSticky').clone());
        });

        // action to deploy the board.
        $('#deployBoard').bind('click', function(event) {
            event.preventDefault();
            board.deploy($(this).attr('href'));
        });
     });

});
