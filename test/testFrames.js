var net = require('net');

conn = net.createConnection({port:5000, host:'localhost'}, function(c) {
    conn.write(Buffer.concat([new Buffer('0000000c', 'hex'), new Buffer('hello world!')]), function() {
        setTimeout(function() {conn.write(Buffer.concat([new Buffer('0000000c', 'hex')]), function() {
            setTimeout(function() {conn.write(Buffer.concat([new Buffer('hello world!')]), function() {
                setTimeout(function() {conn.write(Buffer.concat([new Buffer('0000', 'hex')]), function() {
                    setTimeout(function() {conn.write(Buffer.concat([new Buffer('000c', 'hex'), new Buffer('hello world!'), new Buffer('0000000c', 'hex'), new Buffer('hello world!')]));});
                })}, 1000)
            })}, 1000)
        })}, 1000)
    });
});
