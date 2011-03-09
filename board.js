
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

function Stack(element, board) {
    var self = this;
    this.board = board;
    
    // our stack element.
    this.element = element;
    this.name = this.element.attr('id');
    
    // owned tickets collection.
    this.tickets = [];
    this.element.find('article').each(function() {
        var ticket = new Ticket($(this), self);
        self.tickets.push(ticket);
    });
}

function Ticket(element, stack) {
    this.element = element;
    this.stack = stack;
}

Ticket.prototype.add = function(stack) {
   console.log('me');

};

(function($) {
    $('.board').each(function(){
        new Board($(this));
    });

    console.log($('#addSticky'));
    $('#addSticky').bind('click', function(event) {
        event.preventDefault();
        console.log('me');
        $('#tplSticky').show();
    });

})(jQuery);
