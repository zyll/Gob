
function Board(element) {
    var self = this;
    this.element = element;
    this.stacks = [];
    this.element.find('.stack').each(function(){
        var stack = new Stack($(this), self);
        self.stacks.push(stack);
    })
    this.element.find('.stack ul').sortable({
        connectWith: ".stack ul"
    });
}

Board.prototype.save = function(url) {
    $.ajax({
        url: url,
        dataType: 'html',
        data: this.element.parent().html(),
        type: 'post',
        processData: false,
        contentType: 'text/html'
    })
}

Board.prototype.deploy = function(url) {
    $.ajax({
        url: url,
        type: 'post',
        processData: false,
        contentType: 'text/html'
    })
}
function Stack(element, board) {
    var self = this;
    this.board = board;
    
    // our stack element.
    this.element = element;
    this.holder = element.find('ul');
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
    this.add($(el).appendTo(this.holder).attr('id', null));
}

function Ticket(element, stack) {
    this.element = element;
    this.stack = stack;
    $(this.element).find('.editable').editable(function(value, settings) { 
        return(value);
    }, { 
        type  : 'textarea',
        submit: 'OK',
    });
}


$(document).ready( function() {
    $('.board').each(function() {
        var board = new Board($(this));
        $('#addSticky').bind('click', function(event) {
            event.preventDefault();
            board.stacks[0].append($('#tplSticky').clone());
        });
        $('#saveBoard').bind('click', function(event) {
            event.preventDefault();
            board.save($(this).attr('href'));
        });
        $('#deployBoard').bind('click', function(event) {
            event.preventDefault();
            board.deploy($(this).attr('href'));
        });
     });

});
