
function Board(element) {
    var self = this;
    this.element = element;
    this.slug = $(element).data('slug');
    this.rev = $(element).data('rev');
    this.rights = $(element).data('rights');
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
            if($(this).parent().hasClass('trash')) {
                $.post(["/board", self.name,
                        "stack", sticky.stack.slug,
                        "sticky", sticky.slug].join('/'),
                        {'_method': 'DELETE'}
                )
                sticky.remove();
            } else {
                var pos = $.inArray(ui.item[0], $(ui.item).parent('ul').find('li'));
                var sticky = self.inMove.sticky;
                var to = self.getStack($(this).data('slug'));
                $.ajax({
                    url: ["/board", self.name,
                        "stack", self.inMove.from.slug,
                        "sticky", sticky.slug,
                        "move"].join('/'),
                    data: {to: to.slug, at: pos},
                    type: 'post'
                });
                sticky.stack.removeSticky(sticky);
                // todo : use pos here
                sticky.stack = to;
                to.stickies.splice(pos, 0, sticky);
            }
        }
    });
}

Board.prototype.userList = function(userList) {
    this.user_list = userList;
    this.refreshAcceptUsers();
}

Board.prototype.refreshAcceptUsers = function() {
    console.log(this)
    this.user_list.dragabbleTo('ul.sortableUser');
    //this.userList.dragabbleTo($(this.element).find('.sortableUser'));
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

Stack.prototype.add = function(el, pos) {
    var ticket = new Ticket(el, this);
    if(typeof(pos) == 'number') {
        this.stickies.splice(pos, 0, ticket);
    } else {
        this.stickies.push(ticket);
    }
}

Stack.prototype.removeSticky = function(sticky) {
    var pos = sticky.index();
    if(pos >= 0) {
        this.stickies.splice(pos, 1);
    }
}

Stack.prototype.getSticky = function(slug) {
    for(var i = 0; i < this.stickies.length; i++)
        if(this.stickies[i].slug == slug) return this.stickies[i];
    return null;
}

Stack.prototype.append = function(el, at) {
    if(typeof(at) == 'number' && this.stickies.length >= 1 && (this.stickies.length - 1) >= at) {
        var element = $('<li/>').append($(el)).insertBefore($(this.stickies[at].element).parent())
        this.add($(element).children()[0], at);
    } else {
        this.holder.append('<li>');
        var element = this.holder.find('li:last')[0];
        this.add($(el).appendTo(element).attr('id', null));
    }
    this.board.refreshAcceptUsers();
}

function Ticket(element, stack) {
    var self = this;
    this.stack = stack;
    this.element = element;
    this.setContent(element);
    // fucking bug avoid to set as a sortable when there's already a user in the zone.
    // so removing them all before.
    var clean_me = $(this.element).find('.sortableUser li.user').remove();
    $(this.element).find('.sortableUser').sortable({
        revert: true,
        receive: function(event, ui) {
            var user = ui.item.find('img').attr('title');
            if($.inArray(user, self.user) >= 0) {
                $(self.element).remove(ui.item);
            } else {
                self.user.push(user);
                $.ajax({
                    url: ["/board", self.stack.board.name,
                        "stack", self.stack.slug,
                        "sticky", self.slug,
                        "user"].join('/'),
                    data: {user: user},
                    type: 'post'
                })
            }
        }
    });
    //then restoring the users...
    $(this.element).find('.sortableUser').append(clean_me);
}

Ticket.fromTpl = function(sticky) {
    var tpl = $('#tplSticky article').clone();
    tpl.data('slug', sticky.slug);
    $.each(['title', 'content'], function(i, item) {
        tpl.find('.' + item).html(sticky[item]);
    })
    return tpl;
}


Ticket.prototype.update = function(sticky) {
    var self = this;
    $.each(['title', 'content'], function(i, item) {
        $(self.element).find('.' + item).html(sticky[item]);
    })
    this.setContent(this.element);
}

Ticket.prototype.remove = function() {
    this.stack.removeSticky(this);
    this.stack = null;
    return $(this.element).parent('li').remove().children();
}

Ticket.prototype.index = function() {
    return $.inArray(this, this.stack.stickies)   
}

Ticket.prototype.setContent = function(element) {
    var self = this;
    this.slug = $(element).data('slug');
    $(this.element).find('.editable').bind('click', function(event) {
        event.preventDefault();
        $('#tplStickyForm').dialog({
            buttons: {
                'Update': function() {
                    var that = this
                    var url = ['/board', self.stack.board.slug,
                        'stack', self.stack.slug,
                        'sticky', self.slug].join('/');
                    $.post(url, $(this).find('form').serialize())
                        .success(function(data, statusCode, xhr) {
                            $(that).dialog('close');
                        })
                },
            },
            open: function() {
                var form = $(self.element).find('form')
                var that = this;
                $.each(['title', 'content'], function(i, item) {
                    $(that).find('*[name="' + item + '"]').val($(self.element).find('.' + item).text());
                })
            }
        });
    });
    this.user = $(this.element).find('li.user img').map(function() {
        return $(this).attr('title');
    });
}

function UserList(element) {
    var self = this;
    this.element = element;
    this.users_elements = $(this.element).find('li.user');
}


UserList.prototype.dragabbleTo = function(element) {
    $(this.users_elements).draggable({
        connectToSortable: element,
        helper: 'clone',
        revert: 'invalid'
    });
}

$(document).ready( function() {
    $('.board').each(function() {
        // instanciate the board
        var board = new Board($(this));
        board.name = location.href.split('/').pop();

        if(board.rights >= 2) {
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
                $('#tplStickyForm').dialog({
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
            
            board.userList(new UserList($('section.users')));
        }

        var socket = new io.Socket();
        socket.connect();
        socket.on('connect', function() {
            socket.send({board: board.slug});
            $('#socketState').removeClass('disconnect').addClass('connect');
        });
        socket.on('message', function(msg) {
            if(msg.rev != board.rev) {
                switch(msg.event) {
                    case 'sticky:new':
                        var stack = board.getStack(msg.sticky.parent.slug);
                        stack.append(Ticket.fromTpl(msg.sticky));
                        break;
                    case 'sticky:update':
                        var stack = board.getStack(msg.sticky.parent.slug);
                        var sticky = stack.getSticky(msg.sticky.slug);
                        sticky.update(msg.sticky);
                        break;
                    case 'sticky:move':
                        var from = board.getStack(msg.from.slug);
                        var to = board.getStack(msg.sticky.parent.slug);
                        var sticky = from.getSticky(msg.sticky.slug);
                        if(sticky) { // if we arent the origin of the move.
                            sticky.stack.removeSticky(sticky);
                            to.append(sticky.remove(), parseInt(msg.at, 10));
                        }
                        break;
                    case 'sticky:remove':
                        var from = board.getStack(msg.sticky.parent.slug);
                        var sticky = from.getSticky(msg.sticky.slug);
                        if(sticky) {
                            sticky.remove();
                        }
                        break;
                }
                board.rev = msg.rev; // updating board current rev.
            } else { // should not happen
                // todo : throw ?
                // console.log('board rev should not match: actual = ' , board.rev , ' ,  message = ', msg.rev)
            }
        });

        socket.on('disconnect', function(){
            $('#socketState').removeClass('connect').addClass('disconnect');
        })

        // action to deploy the board.
        $('#deployBoard').bind('click', function(event) {
            event.preventDefault();
            board.deploy($(this).attr('href'));
        });
     });

});
