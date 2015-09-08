(function(define) {define(function(require) {
    var _ = require('lodash');
    var net = require('net');
    var through = require('through2');
    var bitSyntax = require('ut-bitsyntax');
    var Port = require('ut-bus/port');
    var util = require('util');
    var codec = require('ut-codec');
    var reconnect = null;

    function TcpPort() {
        Port.call(this);
        this.conn = null;
        this.server = null;
        this.conCount = 0;
        this.socketTimeOut = 60000 * 10;
        this.framePattern = null;
        this.frameBuilder = null;
        this.codec = null;
        this.connRouter = null;
        this.config = {
            id: null,
            logLevel: '',
            type: 'tcp',
            host: '127.0.0.1',
            port: null,
            listen: false,
            ssl: false,
            connRouter: null,
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

        reconnect = this.config.ssl ? require('ut-bus/reconnect-tls') : require('ut-bus/reconnect-net');

        if (this.config.format) {
            if (this.config.format.size) {
                this.framePattern = bitSyntax.matcher('size:' + this.config.format.size + ', data:size/binary, rest/binary');
                this.frameBuilder = bitSyntax.builder('size:' + this.config.format.size + ', data:size/binary');
            }
            if (this.config.format.codec) {
                var Codec = codec.get(this.config.format.codec);
                this.codec = new Codec(this.config.format);
            }
        }
    };

    TcpPort.prototype.incConnections = function incConnections() {
        this.conCount += 1;
        if (this.conCount > 0x1FFFFFFFFFFFFF) {
            this.conCount = 1;
        }
    };

    TcpPort.prototype.start = function start(callback) {
        Port.prototype.start.apply(this, arguments);
        this.connRouter = this.config.connRouter;
        this.socketTimeOut = this.config.socketTimeOut || this.socketTimeOut;
        var port = this;

        if (this.config.listen) {
            this.server = net.createServer(function(c) {
                this.incConnections();
                this.pipe(c, {trace:0, callbacks:{}, conId:this.conCount});
            }.bind(this));
            this.server.listen(this.config.port);
        } else {
            var connProp;
            if (this.config.ssl) {
                connProp = {
                    host: this.config.host,
                    port: this.config.port,
                    rejectUnauthorized: false
                };
            } else {
                connProp = {
                    host: this.config.host,
                    port: this.config.port
                };
            }
            reconnect(function(stream) {
                this.incConnections();
                var t = through({objectMode: true}, function(chnk, enc, next) {
                    this.push(chnk);
                    next();
                });
                this.pipe(t, {trace:0, callbacks:{}});
                t.write(new Buffer(JSON.stringify({'opcode': 'portConnected'})));
                t.pipe(stream).pipe(t);
            }.bind(this)).connect(connProp)
            .on('error', function(err) {
                this.log && this.log.error && this.log.error(err);
            }.bind(this));
        }
    };

    return TcpPort;

});}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));
