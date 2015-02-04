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
        this.server = null;
        this.conCount = 0;
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

    TcpPort.prototype.incConnections = function incConnections() {
        if (++this.conCount > 0x1FFFFFFFFFFFFF) { //Number.MAX_SAFE_INTEGER
            this.conCount = 1;
        }
    };

    TcpPort.prototype.start = function start(callback) {
        Port.prototype.start.apply(this, arguments);

        if (this.config.listen) {
            this.server = net.createServer(function(c) {
                this.incConnections();
                this.pipe(c, {trace:0, callbacks:{}, conId:this.conCount});
            }.bind(this));
            this.server.listen(this.config.port);
        } else {
            this.conn = net.createConnection({port:this.config.port, host:this.config.host}, function() {
                this.incConnections();
                this.pipe(this.conn, {trace:0, callbacks:{}});
            }.bind(this));
        }
    };

    return TcpPort;

});}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));
