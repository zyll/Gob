# install
    need node > 0.4.1 (but may be 0.4.2 won't handle libxmmljs)
    lixmljs need scons and lixml2 (may be libxml2-dev)
    need npm
    npm install .

# run
    node app.js
    http://localhost:3000 in an html5 complient browser (dev is done using chromium)

# test
  be sur boards/__test__ is not present
  vows test/*
