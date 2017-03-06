'use strict';

var net = require('net');
var through2 = require('through2');
var bitSyntax = require('ut-bitsyntax');
var Port = require('ut-bus/port');
var util = require('util');

function TcpPort() {
    Port.call(this);
    this.re = null;
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
        localPort: null,
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
    this._reconnect = this.config.ssl ? require('ut-bus/reconnect-tls') : require('ut-bus/reconnect-net');

    if (this.config.format) {
        this.codec = undefined;
        if (this.config.format.codec) {
            var codecType = typeof this.config.format.codec;
            var Codec;

            if (codecType === 'function') {
                Codec = this.config.format.codec;
            } else if (codecType === 'string') {
                // Codec = codec.get(this.config.format.codec);
                throw new Error('Use format.codec:require(\'ut-codec/' + this.config.format.codec + '\') instead of ' +
                    'format.codec:\'' + this.config.format.codec + '\'');
            }
            this.codec = new Codec(this.config.format);
        }
        if (this.codec && (this.codec.frameReducer) && (this.codec.frameBuilder)) {
            this.frameBuilder = this.codec.frameBuilder;
            this.framePattern = this.codec.frameReducer;
        } else if (this.config.format.size) {
            this.frameBuilder = bitSyntax.builder('size:' + this.config.format.size + ', data:size/binary');
            if (this.config.format.sizeAdjust) {
                this.framePatternSize = bitSyntax.matcher('size:' + this.config.format.size + ', data/binary');
                this.framePattern = bitSyntax.matcher('data:size/binary, rest/binary');
            } else {
                this.framePattern = bitSyntax.matcher('size:' + this.config.format.size + ', data:size/binary, rest/binary');
            }
        }
    }
};

TcpPort.prototype.incConnections = function incConnections() {
    this.conCount += 1;
    if (this.conCount > 0x1FFFFFFFFFFFFF) {
        this.conCount = 1;
    }
};

TcpPort.prototype.start = function start() {
    this.bus && this.bus.importMethods(this.config, this.config.imports, undefined, this);
    Port.prototype.start.apply(this, arguments);
    this.connRouter = this.config.connRouter;
    this.socketTimeOut = this.config.socketTimeOut || this.socketTimeOut;

    var notify = (event, stream, context) => {
        this.log.info && this.log.info({$meta: {mtid: 'event', opcode: 'port.' + event}, context});
        this.receive(stream, [{}, {opcode: event, mtid: 'notification'}], context);
    };

    var onConnection = stream => {
        this.incConnections();
        var context = {
            trace: 0,
            callbacks: {},
            localAddress: stream.localAddress,
            localPort: stream.localPort,
            remoteAddress: stream.remoteAddress,
            remotePort: stream.remotePort
        };

        if (this.config.listen) {
            context.conId = this.conCount;
        }

        stream.on('close', () => {
            notify('disconnected', through2({objectMode: true}, nullWriter), context);
        })
        .on('error', (err) => {
            this.log && this.log.error && this.log.error(err);
        });

        var streams = this.pipe(stream, context);
        notify('connected', streams[2], context);
    };

    if (this.config.listen) {
        this.server = net.createServer(onConnection)
        .on('close', () => {
            notify('close', through2({objectMode: true}, nullWriter), {trace: 0, callbacks: {}});
        })
        .on('error', err => {
            this.log && this.log.error && this.log.error(err);
        });
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
        if (this.config.localPort) {
            connProp.localPort = this.config.localPort;
        }
        this.re = this._reconnect(onConnection)
        .on('error', (err) => {
            this.log && this.log.error && this.log.error(err);
        })
        .connect(connProp);
    }
};

TcpPort.prototype.stop = function stop() {
    if (this.re) {
        var e = this.re.disconnect();
        e && e._connection && e._connection.unref();
    }
    if (this.server) {
        this.server.close();
        this.server.unref();
        this.server = null;
    }
    Port.prototype.stop.apply(this, Array.prototype.slice.call(arguments));
};

function nullWriter(chunk, encoding, cb) {
    cb();
}

module.exports = TcpPort;
