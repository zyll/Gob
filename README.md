# Board

Organise in a board way your shared todo list.

Features:

* as much boards as you need.
* flexible board rows (stacks).
* stickies have editable fields title, content and user.
* stickies are drag&droppable in order to move them at the rigth place.
* can deploy a stack (mainly the last one), it is to say flush the stack and keep an history (wip).
* each change are notify to connected client in order to propagate change imediatly.

Hope to provide more feature quicly. A plugin way can be a great idea, in order to choose only the feature needed by a projet and keep the board simple.

Feel free to feedback.

# install

    couchdb
    need node > 0.4.2
    need npm
    need imagemagick
    npm bundle .

# run

    node app.js
    http://localhost:3000 (in an html5 complient browser).

# test

  vows test/*
