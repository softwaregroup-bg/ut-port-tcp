require('repl').start({useGlobal:true});

var tcp = require('../');
c = new tcp();
c.config.port = 5000;
c.config.listen = true;
c.config.sizeFormat = '32/integer';
c.init();
c.start();
