var net = require('net');
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
            id: null,
            sizeAdjust: 0
        }
    };
}

util.inherits(TcpPort, Port);

TcpPort.prototype.init = function init() {
    Port.prototype.init.apply(this, arguments);

    this.bytesSent = this.counter && this.counter('counter', 'bs', 'Bytes sent');
    this.bytesReceived = this.counter && this.counter('counter', 'br', 'Bytes received');
    reconnect = this.config.ssl ? require('ut-bus/reconnect-tls') : require('ut-bus/reconnect-net');

    if (this.config.format) {
        if (this.config.format.size) {
            this.frameBuilder = bitSyntax.builder('size:' + this.config.format.size + ', data:size/binary');
            if (this.config.format.sizeAdjust) {
                this.framePatternSize = bitSyntax.matcher('size:' + this.config.format.size + ', data/binary');
                this.framePattern = bitSyntax.matcher('data:size/binary, rest/binary');
            } else {
                this.framePattern = bitSyntax.matcher('size:' + this.config.format.size + ', data:size/binary, rest/binary');
            }
        }
        if (this.config.format.codec) {
            var codecType = typeof(this.config.format.codec);
            var Codec;

            if (codecType === 'function') {
                Codec = this.config.format.codec;
            } else if (codecType === 'string') {
                Codec = codec.get(this.config.format.codec);
            }
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
            this.pipe(c, {trace: 0, callbacks: {}, conId: this.conCount});
        }.bind(this));
        this.server.listen(this.config.port);
    } else {
        var connProp;
        var options = {};
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
        if (this.config.localPort) {
            options.localPort = this.config.localPort;
        }
        reconnect(options, function(stream) {
            this.incConnections();
            var context = {trace: 0, callbacks: {}, conId: this.conCount};
            var streams = this.pipe(stream, context);
            port.receive(streams[2], [{}, {opcode: 'connected', mtid: 'notification', context: context}]);
        }.bind(this)).connect(connProp)
            .on('error', function(err) {
                this.log && this.log.error && this.log.error(err);
            }.bind(this));
    }
};

module.exports = TcpPort;
