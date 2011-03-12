
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
        data: this.element.html(),
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
    this.element.find('article').each($.proxy(this.add, this));
}

Stack.prototype.add = function(el) {
    var ticket = new Ticket(el, $(this));
    this.tickets.push(ticket);
    console.log('pouet')
}

Stack.prototype.append = function(el) {
    this.add($(el).appendTo(this.holder).attr('id', null));
}

function Ticket(element, stack) {
    this.element = element;
    this.stack = stack;
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
     });
});
