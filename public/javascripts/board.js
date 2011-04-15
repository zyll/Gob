
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
    this.inMove = null;
    $(res).sortable({
        connectWith: res,
        remove: function(event, ui) {
            self.inMove = {stack: $(this).data('slug'), sticky: $(ui.item).find('article.sticky').data('slug')};
        },
        receive: function(event, ui) {
            self.element.trigger('ticket:move', [self.inMove.sticky, self.inMove.stack, $(this).data('slug')]);

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
    this.element.find('article').each(function(index, element) {
        self.add(element);
    });
}

Stack.prototype.add = function(el) {
    var ticket = new Ticket(el, $(this));
}

Stack.prototype.append = function(el) {
    this.holder.append('<li>');
    this.add($(el).appendTo(this.holder.find('li:last')[0]).attr('id', null));
}

function Ticket(element, stack) {
    this.stack = stack;
    this.setContent(element)
}

Ticket.prototype.setContent = function(element) {
    var self = this;
    this.element = element;
    $(this.element).find('.editable').live('click', function(event) {
        var link = this
        event.preventDefault();
        $('#tplSticky').dialog({
            buttons: {
                'Create': function() {
                    var that = this
                    $.post($(link).attr('href'), $(this).find('form').serialize())
                        .success(function(data, statusCode, xhr) {
                            $(that).dialog('close');
                            $(self.element).trigger('ticket:change', [self, xhr.responseText]);
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
Ticket.prototype.replaceBy = function(element) {
}

$(document).ready( function() {
    
    var socket = new io.Socket();
    socket.connect();
    socket.on('connect', function() {
    })
    socket.on('message', function(data) {console.log(data)})
    socket.on('disconnect', function(){console.log('disconnet')})

    $('.board').each(function() {

        // instanciate the board
        var board = new Board($(this));

        board.name = location.href.split('/').pop()
        
        socket.send({board: board.name})

        board.element.bind('ticket:move', function(event, sticky, from, to) {
            $.ajax({
                url: ["/board", board.name,
                    "stack", from,
                    "sticky", sticky,
                    "move"].join('/'),
                data: {to: to},
                type: 'post',
                success: function() {
                    self.element.trigger('board:saved');
                }
            });
        });

        board.element.bind('ticket:change', function(event, old, last) {
            $(old.element).html($(last).children());
        });

        board.element.bind('ticket:new', function(event, sticky, stack) {
            $.ajax({
                url: ["/board", board.name,
                    "stack", from,
                    "sticky"].join('/'),
                data: sticky,
                type: 'post',
                success: function() {
                    self.element.trigger('board:saved');
                }
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
                                board.stacks[0].append(data)
                            })
                    }
                }
            });


        });

        // action to deploy the board.
        $('#deployBoard').bind('click', function(event) {
            event.preventDefault();
            board.deploy($(this).attr('href'));
        });
     });

});
