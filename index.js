(function(define) {define(function(require) {
    //dependencies
    var when = require('when');
    var net = require('net');
    var bitSyntax = require('bitsyntax');
    var Port = require('ut-bus/port');
    var util = require('util');
    var utcodec = require('ut-codec');
    var through2 = require('through2');

    function TcpPort() {
        Port.call(this);
        this.conn = null;
        this.framePattern = null;
        this.frameBuilder = null;
        this.codec = null;
        this.config = {
            id: null,
            logLevel: '',
            type: 'tcp',
            host: '127.0.0.1',
            port: null,
            listen: false,
            format: {
                size: null,
                codec: null,
                id: null
            }
        };
    }

    util.inherits(TcpPort, Port);

    TcpPort.prototype.decode = function decode() {
        var buffer = new Buffer(0);
        var port = this;

        return through2.obj(function decodePacket(packet, enc, callback) {
            port.log.trace && port.log.trace({_opcode:'bytes.in', buffer:packet});

            if (port.framePattern) {
                buffer = Buffer.concat([buffer, packet]);
                var frame;
                while (frame = port.framePattern(buffer)) {
                    buffer = frame.rest;
                    this.push(port.codec ? port.codec.decode(frame.data) : {payload:frame.data});
                }
                callback();
            } else {
                callback(null, {payload:packet});
            }
        });
    };

    TcpPort.prototype.encode = function encode() {
        var port = this;

        return through2.obj(function encodePacket(message, enc, callback) {
            port.log.trace && port.log.trace(message);
            var buffer;
            var size;
            if (port.codec) {
                buffer = port.codec.encode(message);
                size = buffer && buffer.length;
            } else if (message && message.payload) {
                buffer = message.payload;
                size = buffer && buffer.length;
            } else {
                buffer = null;
                size = null;
            }
            if (port.frameBuilder) {
                buffer =  port.frameBuilder({size:size, data:buffer});
            }
            if (buffer) {
                port.log.trace && port.log.trace({_opcode:'bytes.out', buffer:buffer});
                callback(null, buffer)
            } else {
                callback();
            }
        });
    };

    TcpPort.prototype.init = function init() {
        Port.prototype.init.apply(this, arguments);

        if (this.config.format) {
            if (this.config.format.size) {
                this.framePattern = bitSyntax.matcher('size:' + this.config.format.size + ', data:size/binary, rest/binary');
                this.frameBuilder = bitSyntax.builder('size:' + this.config.format.size + ', data:size/binary');
            }
            if (this.config.format.codec) {
                var x = utcodec.get(this.config.format.codec);
                this.codec = new x(this.config.format);
            }
        }
    };

    TcpPort.prototype.start = function start(callback) {
        Port.prototype.start.apply(this, arguments);

        if (this.config.listen) {
            this.conn = net.createServer(function(c) {
                this.pipe(c);
            }.bind(this));
            this.conn.listen(this.config.port);
        } else {
            this.conn = net.createConnection({port:this.config.port, host:this.config.host}, function(c) {
                this.pipe(c);
            }.bind(this));
        }
    };

    return TcpPort;

});}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));
