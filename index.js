(function(define) {define(function(require) {
    //dependencies
    var when = require('when');
    var net = require('net');
    var bitSyntax = require('bitsyntax');

    return function TcpPort() {
        //private fields
        var conn = null;
        var framePattern = null;
        var codec = null;

        function Receiver(callback) {
            var buffer = new Buffer(0);

            return function(packet) {
                buffer = Buffer.concat([buffer, packet]);
                console.log('packet:', packet, 'buffer:', buffer.toString());

                if (framePattern) {
                    var frame;
                    while (frame = framePattern(buffer)) {
                        buffer = frame.rest;
                        callback(codec ? codec.decode(frame.data) : {payload:frame.data});
                    }
                }
            };
        }

        return {
            bus: null,
            utcodec: null,
            config: {
                id: null,
                type: 'tcp',
                host: '127.0.0.1',
                port: null,
                listen: false,
                format: {
                    size: null,
                    codec: null,
                    id: null
                }
            },
            init: function() {
                var methods = {};
                methods['ports.' + this.config.id + '.start'] = this.start;
                methods['ports.' + this.config.id + '.stop'] = this.stop;
                if (this.bus) {
                    this.bus.register(methods);
                }
                if (this.config.format) {
                    if (this.config.format.size) {
                        framePattern = bitSyntax.matcher('len:' + this.config.format.size + ', data:len/binary, rest/binary');
                    }
                    if (this.config.format.codec) {
                        codec = this.utcodec.get(this.config.format.codec).init({});
                    }
                }
            },
            start: function(callback) {
                if (this.config.listen) {
                    conn = net.createServer(function(c) {
                        c.on('data', new Receiver(this.receive.bind(this)));
                    });
                    conn.listen(this.config.port);
                } else {
                    conn = net.createConnection({port:this.config.port, host:this.config.host}, function(c) {
                        c.on('data', new Receiver(this.receive.bind(this)));
                    });
                }
            },

            stop: function(callback) {

            },

            receive: function(msg) {
                console.log('message:', msg);
            }
        }
    }

});}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));
