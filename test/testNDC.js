var tcp = require('../');
var c = new tcp();
c.utcodec = require('ut-codec');
c.config.port = 5000;
c.config.listen = true;
c.config.format.size = '16/integer';
c.config.format.codec = 'ndc';
c.init();
c.start();
