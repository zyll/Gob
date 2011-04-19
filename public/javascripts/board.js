
function Board(element) {
    var self = this;
    this.element = element;
    this.slug = $(element).data('slug');
    this.rev = $(element).data('rev');
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
    this.inMove = null;
    $(res).sortable({
        connectWith: res,
        remove: function(event, ui) {
            var stack = self.getStack($(this).data('slug'));
            var sticky = stack.getSticky($(ui.item).find('article.sticky').data('slug'));
            self.inMove = { from: stack, sticky: sticky};
        },
        receive: function(event, ui) {
            var sticky = self.inMove.sticky;
            var to = self.getStack($(this).data('slug'));
            $.ajax({
                url: ["/board", self.name,
                    "stack", self.inMove.from.slug,
                    "sticky", sticky.slug,
                    "move"].join('/'),
                data: {to: to.slug},
                type: 'post'
            })
            sticky.stack.removeSticky(sticky);
            sticky.stack = to;
            to.stickies.push(sticky);
        }
    });
}

Board.prototype.addStack = function(stack) {
    this.stacks.push(stack);
}

Board.prototype.getStack = function(slug) {
    for(var i = 0; i < this.stacks.length; i++)
        if(this.stacks[i].slug == slug) return this.stacks[i];
    return null;
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
    this.slug = this.holder.data('slug');
    this.name = this.element.attr('id');
    
    // owned tickets collection.
    this.stickies = [];
    this.element.find('article').each(function(index, element) {
        self.add(element);
    });
}

Stack.prototype.add = function(el) {
    var ticket = new Ticket(el, this);
    this.stickies.push(ticket);
}

Stack.prototype.removeSticky = function(sticky) {
    var pos = $.inArray(sticky, this.stickies);
    if(pos >= 0) {
        this.stickies.splice(pos, 1);
    }
}

Stack.prototype.getSticky = function(slug) {
    for(var i = 0; i < this.stickies.length; i++)
        if(this.stickies[i].slug == slug) return this.stickies[i];
    return null;
}

Stack.prototype.append = function(el) {
    this.holder.append('<li>');
    var element = this.holder.find('li:last')[0];
    $(el).appendTo(element).attr('id', null)
    this.add($(element).children()[0]);
}

function Ticket(element, stack) {
    this.stack = stack;
    this.element = element;
    this.setContent(element)
}


Ticket.prototype.update = function(element) {
    $(this.element).html($(element).children());
    this.setContent(element);
}

Ticket.prototype.remove = function() {
    this.stack.removeSticky(this);
    this.stack = null;
    return $(this.element).parent('li').remove().children();
}

Ticket.prototype.setContent = function(element) {
    var self = this;
    this.slug = $(element).data('slug');
    $(this.element).find('.editable').live('click', function(event) {
        var link = this
        event.preventDefault();
        $('#tplSticky').dialog({
            buttons: {
                'Update': function() {
                    var that = this
                    $.post($(link).attr('href'), $(this).find('form').serialize())
                        .success(function(data, statusCode, xhr) {
                            $(that).dialog('close');
                        })
                },
            },
            open: function() {
                var form = $(self.element).find('form')
                var that = this;
                $.each(['title', 'content', 'user'], function(i, item) {
                    $(that).find('*[name="' + item + '"]').val($(self.element).find('.' + item).text());
                })
            }
        });
    })
}

$(document).ready( function() {
    $('.board').each(function() {
        // instanciate the board
        var board = new Board($(this));
        board.name = location.href.split('/').pop()

        board.element.bind('ticket:new', function(event, sticky, stack) {
            $.ajax({
                url: ["/board", board.name,
                    "stack", from,
                    "sticky"].join('/'),
                data: sticky,
                type: 'post'
            });
       
        });
        var trash = new Stack($("section.trash"), board);
        board.addStack(trash);
        board.connectStack();
        // use template to add new ticket to the first stack
        $('#addSticky').bind('click', function(event) {
            event.preventDefault();
            $('#tplSticky').dialog({
                buttons: {
                    'Create': function() {
                        var self = this
                        var form = $(this).find('form');
                        $.ajax(form.attr('action'), {type: form.attr('method'), data: form.serialize()})
                            .success(function(data, statusCode, xhr) {
                                $(self).dialog('close');
                            })
                    }
                }
            });
        });
 
        var socket = new io.Socket();
        socket.connect();
        socket.on('connect', function() {
            console.log('board ' + board.slug + ' connected');
            socket.send({board: board.slug});
        });
        socket.on('message', function(msg) {
            if(msg.rev != board.rev) { // should not happen
                switch(msg.event) {
                    case 'sticky:new':
                        var stack = board.getStack(msg.sticky.parent.slug);
                        stack.append(msg.html);
                        break;
                    case 'sticky:new':
                        var stack = board.getStack(msg.sticky.parent.slug);
                        stack.append(msg.html);
                        break;
                    case 'sticky:move':
                        var from = board.getStack(msg.from.slug);
                        var to = board.getStack(msg.sticky.parent.slug);
                        var sticky = from.getSticky(msg.sticky.slug);
                        if(sticky) { // if we are the origin of the move.
                            sticky.stack.removeSticky(sticky);
                            to.append(sticky.remove())
                        }
                        break;
                }
                board.rev = msg.rev; // updating board current rev.
            } else {
                // todo : throw ?
                // console.log('board rev should not match: actual = ' , board.rev , ' ,  message = ', msg.rev)
            }
        });

        socket.on('disconnect', function(){console.log('disconnet')})

        // action to deploy the board.
        $('#deployBoard').bind('click', function(event) {
            event.preventDefault();
            board.deploy($(this).attr('href'));
        });
     });

});
