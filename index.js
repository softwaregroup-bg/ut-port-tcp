(function(define) {define(function(require) {
    //dependencies
    var when = require('when');
    var net = require('net');
    var bitSyntax = require('bitsyntax');
    var Port = require('ut-bus/port');
    var util = require('util');
    var utcodec = require('ut-codec');

    function TcpPort() {
        Port.call(this);
        this.conn = null;
        this.framePattern = null;
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

    function Receiver(port) {
        var buffer = new Buffer(0);

        return function processPacket(packet) {
            buffer = Buffer.concat([buffer, packet]);
            this.level.trace && this.log.trace(packet);

            if (this.framePattern) {
                var frame;
                while (frame = this.framePattern(buffer)) {
                    buffer = frame.rest;
                    this.receive(this.codec ? this.codec.decode(frame.data) : {payload:frame.data});
                }
            }
        }.bind(port);
    }

    TcpPort.prototype.init = function init() {
        Port.prototype.init.apply(this, arguments);

        if (this.config.format) {
            if (this.config.format.size) {
                this.framePattern = bitSyntax.matcher('len:' + this.config.format.size + ', data:len/binary, rest/binary');
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
                c.on('data', new Receiver(this));
            }.bind(this));
            this.conn.listen(this.config.port);
        } else {
            this.conn = net.createConnection({port:this.config.port, host:this.config.host}, function(c) {
                c.on('data', new Receiver(this));
            }.bind(this));
        }
    };

    TcpPort.prototype.receive = function(msg) {
        this.level.debug && this.log.debug(msg);
    };

    return TcpPort;

});}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));
