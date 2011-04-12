var http = require('http'),
    events = require('events')
  , Futures = require('futures')

var client = http.createClient(5984, '127.0.0.1');
function r(method, url, doc) {
    var promise = new(events.EventEmitter);
    var request = client.request(method, url, {});

    if (doc) { request.write(JSON.stringify(doc)) }

    request.addListener('response', function (res) {
        var body = '';

        res.setEncoding('utf8');
        res.addListener('data', function (chunk) {
            body += (chunk || '');
        }).addListener('end', function () {
            var obj, response;

            try { obj = JSON.parse(body) }
            catch (e) { return promise.emit('error', e) }

            promise.emit('success', obj);
        });
    });
    request.end();
    return promise;
}

module.exports = {
    clean: function() {
        var join = new Futures.join()
        ;['board_testmodel', 'board_test_board'].forEach(function (db) {
            var del = Futures.future()
            join.add(del)
            r('DELETE', '/' + db).addListener('success', del.deliver);
        })
        return join
    },
    populate: function() {
        var done = new Futures.join()
        var board1 = Futures.future()
        var board2 = Futures.future()
        var board3 = Futures.future()
        done.add(board1)
        done.add(board2)
        done.add(board3)

        var db = '/board_test_board'
        r('PUT', db).addListener('success', function() {
            r('PUT', db + "/board1", {type: 'board', name: 'conquer the world', slug: 'conquer-th',
                stacks: [
                    {type: 'stack', name: 'todo', slug: 'todo',
                        stickies: [
                            {type: 'sticky', title: 'get an army', slug: 'get-an-arm',
                                content: ''},
                            {type: 'sticky', title: 'train the army', slug: 'train-the-',
                                content: ''}
                        ]},
                    {type: 'stack', name: 'in progress', slug: 'in-progres',
                        stickies: []},
                    {type: 'stack', name: 'done', slug: 'done',
                        stickies: []},
                ]})
                .addListener('success', board1.deliver) 
            
            r('PUT', db + "/board2", {type: 'board', name: 'board2', slug: 'board2', stacks: []})
                .addListener('success', board2.deliver)

            r('PUT', db + "/board3", {type: 'board', name: 'moving', slug: 'moving',
                stacks: [
                    {type: 'stack', name: 'todo', slug: 'todo',
                        stickies: [
                            {type: 'sticky', title: 'remove', slug: 'remove',
                                content: 'remove a sticky from a stack using its instance'},
                            {type: 'sticky', title: 'move', slug: 'move',
                                content: 'move a sticky from a stack to another one'},
                            {type: 'sticky', title: 'add by pos', slug: 'add-by-pos',
                                content: 'add a sticky to a stack at a given position'}
                        ]},
                    {type: 'stack', name: 'in progress', slug: 'progress',
                        stickies: []},
                    {type: 'stack', name: 'done', slug: 'done',
                        stickies: []},
                ]})
                .addListener('success', board3.deliver) 
        });
        return done
    }
}
