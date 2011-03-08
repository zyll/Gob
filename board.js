
function Board(element) {
    var self = this;
    this.element = element;
    this.stacks = [];
    this.element.find('.stack').each(function(){
        var stack = new Stack($(this), self);
        self.stacks.push(stack);
    });
}

function Stack(element, board) {
    var self = this;
    this.board = board;
    // our stack element
    this.element = element;
    // owned tickets collection
    this.tickets = [];
    this.element.find('article').each(function() {
        var ticket = new Ticket($(this), self);
        self.tickets.push(ticket);
    });
}

function Ticket(element, stack) {
    this.element = element;
    this.stack = stack;
    this.element.draggable({containment: this.stack.board.element});
}

(function($) {

    $('.board').each(function(){
        new Board($(this));
    });

})(jQuery);
